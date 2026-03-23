-- =============================================
-- 031_modulos_integrados.sql
-- Inventário, integração estoque, qualidade FK
-- =============================================

-- 1. Tabelas de Inventário
CREATE TABLE IF NOT EXISTS inventarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_inventario DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'finalizado')),
  responsavel_id UUID REFERENCES profiles(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventario_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventario_id UUID NOT NULL REFERENCES inventarios(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES materiais(id),
  quantidade_sistema NUMERIC(12,4) NOT NULL DEFAULT 0,
  quantidade_contada NUMERIC(12,4),
  diferenca NUMERIC(12,4) GENERATED ALWAYS AS (COALESCE(quantidade_contada, 0) - quantidade_sistema) STORED,
  justificativa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Coluna nova em ocorrencias
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES fornecedores(id);

-- 3. RLS para tabelas novas
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventarios_auth" ON inventarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "inventario_itens_auth" ON inventario_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_inventario_itens_inventario ON inventario_itens(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_itens_material ON inventario_itens(material_id);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_fornecedor ON ocorrencias(fornecedor_id);

-- 5. Trigger: Compras → Estoque (recebimento gera entrada)
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS NULL OR OLD.status != 'recebido') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      pci.material_id,
      'entrada',
      pci.quantidade,
      'pedido_compra',
      NEW.id,
      'Entrada automática - Pedido de Compra #' || NEW.numero
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id;

    -- Atualiza saldos
    UPDATE estoque_saldos es
    SET quantidade = es.quantidade + pci.quantidade,
        updated_at = NOW()
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND es.material_id = pci.material_id;

    -- Insere saldo para materiais que ainda não têm registro
    INSERT INTO estoque_saldos (material_id, quantidade)
    SELECT pci.material_id, pci.quantidade
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM estoque_saldos WHERE material_id = pci.material_id)
    ON CONFLICT (material_id) DO UPDATE SET quantidade = estoque_saldos.quantidade + EXCLUDED.quantidade;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_recebimento ON pedidos_compra;
CREATE TRIGGER trg_compra_recebimento
  AFTER UPDATE ON pedidos_compra
  FOR EACH ROW
  EXECUTE FUNCTION fn_compra_recebimento_estoque();

-- 6. Trigger: Compras → Financeiro (aprovação gera conta a pagar)
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    INSERT INTO contas_pagar (
      fornecedor_id, pedido_compra_id, descricao, valor, data_vencimento, status
    ) VALUES (
      NEW.fornecedor_id,
      NEW.id,
      'Pedido de Compra #' || NEW.numero,
      NEW.valor_total,
      COALESCE(NEW.data_entrega, CURRENT_DATE + INTERVAL '30 days'),
      'pendente'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_conta_pagar ON pedidos_compra;
CREATE TRIGGER trg_compra_conta_pagar
  AFTER UPDATE ON pedidos_compra
  FOR EACH ROW
  EXECUTE FUNCTION fn_compra_gera_conta_pagar();

-- 7. Trigger: Produção → Estoque (reserva e saída)
CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- OP entra em produção → reserva materiais
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'reserva',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Reserva automática - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;
  END IF;

  -- OP finalizada → libera reserva + saída definitiva
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    -- Liberação da reserva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'liberacao_reserva',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Liberação reserva - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Saída definitiva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao)
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Consumo produção - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Atualiza saldos (decrementa)
    UPDATE estoque_saldos es
    SET quantidade = es.quantidade - (mm.quantidade * COALESCE(NEW.quantidade, 1)),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id
      AND es.material_id = mm.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_producao_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_estoque
  AFTER UPDATE ON ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_producao_estoque();
