-- Migration 032: Fix trigger column mismatches and duplicate trigger
-- Fixes: fn_compra_recebimento_estoque, fn_compra_gera_conta_pagar, fn_producao_estoque
-- Removes: duplicate saida logic from fn_producao_estoque (debitar_estoque_producao handles it)
-- Expands: ocorrencias tipo CHECK to include material_defeituoso, outro
-- Adds: prioridade column to ocorrencias (used by code but missing from DB)

-- ============================================================
-- 1. Fix fn_compra_recebimento_estoque
--    observacao → motivo
--    quantidade → quantidade_disponivel
-- ============================================================
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS NULL OR OLD.status != 'recebido') THEN
    -- Entrada de cada item do pedido de compra
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT pci.material_id, 'entrada', pci.quantidade, 'pedido_compra', NEW.id,
      'Entrada automática - Pedido de Compra #' || COALESCE(NEW.numero, NEW.id::text)
    FROM pedido_compra_itens pci WHERE pci.pedido_compra_id = NEW.id;

    -- Atualizar saldos existentes
    UPDATE estoque_saldos es
    SET quantidade_disponivel = es.quantidade_disponivel + pci.quantidade, updated_at = NOW()
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id AND es.material_id = pci.material_id;

    -- Criar saldos para materiais novos
    INSERT INTO estoque_saldos (material_id, quantidade_disponivel)
    SELECT pci.material_id, pci.quantidade
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM estoque_saldos WHERE material_id = pci.material_id)
    ON CONFLICT (material_id) DO UPDATE SET quantidade_disponivel = estoque_saldos.quantidade_disponivel + EXCLUDED.quantidade_disponivel;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. Fix fn_compra_gera_conta_pagar
--    descricao → numero_titulo
--    valor → valor_original
--    data_entrega → previsao_entrega
--    'pendente' → 'a_pagar'
--    + idempotency guard
-- ============================================================
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    -- Guard de idempotência: não criar duplicata
    IF NOT EXISTS (SELECT 1 FROM contas_pagar WHERE pedido_compra_id = NEW.id) THEN
      INSERT INTO contas_pagar (
        fornecedor_id, pedido_compra_id, numero_titulo, valor_original,
        data_vencimento, data_emissao, status
      )
      VALUES (
        NEW.fornecedor_id,
        NEW.id,
        'PC-' || COALESCE(NEW.numero, NEW.id::text),
        NEW.valor_total,
        COALESCE(NEW.previsao_entrega, CURRENT_DATE + INTERVAL '30 days'),
        CURRENT_DATE,
        'a_pagar'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. Fix fn_producao_estoque
--    observacao → motivo
--    quantidade → quantidade_disponivel / quantidade_reservada
--    REMOVE saida block (debitar_estoque_producao already handles it)
--    Keep: reserva on em_producao + liberacao_reserva on finalizado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- Reserva de materiais quando OP entra em produção
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT mm.material_id, 'reserva', mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao', NEW.id, 'Reserva automática - OP #' || COALESCE(NEW.numero, NEW.id::text)
    FROM modelo_materiais mm WHERE mm.modelo_id = NEW.modelo_id;

    -- Atualizar quantidade_reservada nos saldos
    UPDATE estoque_saldos es
    SET quantidade_reservada = COALESCE(es.quantidade_reservada, 0) + (mm.quantidade * COALESCE(NEW.quantidade, 1)),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id AND es.material_id = mm.material_id;
  END IF;

  -- Liberação de reserva quando OP é finalizada (saída feita por debitar_estoque_producao)
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT mm.material_id, 'liberacao_reserva', mm.quantidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao', NEW.id, 'Liberação reserva - OP #' || COALESCE(NEW.numero, NEW.id::text)
    FROM modelo_materiais mm WHERE mm.modelo_id = NEW.modelo_id;

    -- Liberar quantidade_reservada nos saldos
    UPDATE estoque_saldos es
    SET quantidade_reservada = GREATEST(0, COALESCE(es.quantidade_reservada, 0) - (mm.quantidade * COALESCE(NEW.quantidade, 1))),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id AND es.material_id = mm.material_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. Expandir CHECK de ocorrencias.tipo
-- ============================================================
ALTER TABLE ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_tipo_check;
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_tipo_check
  CHECK (tipo = ANY (ARRAY['retrabalho', 'devolucao', 'erro_producao', 'erro_instalacao', 'divergencia_cliente', 'material_defeituoso', 'outro']));

-- ============================================================
-- 5. Adicionar coluna prioridade a ocorrencias (usada pelo código mas ausente no DB)
-- ============================================================
ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'media';
ALTER TABLE ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_prioridade_check;
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_prioridade_check
  CHECK (prioridade = ANY (ARRAY['baixa', 'media', 'alta', 'critica']));
