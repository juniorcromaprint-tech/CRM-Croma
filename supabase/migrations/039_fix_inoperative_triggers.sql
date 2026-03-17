-- 039_fix_inoperative_triggers.sql
-- Fix the 3 inoperative triggers: producao→estoque, compras→conta_pagar, compras→estoque

-- 1. When an OP is completed (status → 'finalizado'), debit materials from estoque
CREATE OR REPLACE FUNCTION fn_producao_debita_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao
    )
    SELECT
      mc.material_id,
      'saida',
      mc.quantidade * COALESCE(pi.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Baixa automática - OP ' || NEW.numero
    FROM pedido_itens pi
    JOIN modelo_composicoes mc ON mc.modelo_id = pi.modelo_id
    WHERE pi.id = NEW.pedido_item_id
      AND mc.material_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_producao_debita_estoque ON ordens_producao;
CREATE TRIGGER trg_producao_debita_estoque
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_producao_debita_estoque();

-- 2. When a pedido_compra is received, create conta_pagar
CREATE OR REPLACE FUNCTION fn_compra_gera_conta_pagar()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') THEN
    INSERT INTO contas_pagar (
      numero_titulo, valor_original, data_vencimento, fornecedor_id, status, pedido_compra_id
    )
    VALUES (
      'PC-' || NEW.numero,
      NEW.valor_total,
      COALESCE(NEW.data_vencimento, NOW() + INTERVAL '30 days'),
      NEW.fornecedor_id,
      'a_pagar',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_gera_conta_pagar ON pedidos_compra;
CREATE TRIGGER trg_compra_gera_conta_pagar
  AFTER UPDATE OF status ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION fn_compra_gera_conta_pagar();

-- 3. When a pedido_compra is received, credit estoque with received items
CREATE OR REPLACE FUNCTION fn_compra_recebimento_estoque()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'recebido' AND (OLD.status IS DISTINCT FROM 'recebido') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, referencia_tipo, referencia_id, observacao
    )
    SELECT
      pci.material_id,
      'entrada',
      pci.quantidade,
      'pedido_compra',
      NEW.id,
      'Recebimento compra #' || NEW.numero
    FROM pedido_compra_itens pci
    WHERE pci.pedido_compra_id = NEW.id
      AND pci.material_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compra_recebimento_estoque ON pedidos_compra;
CREATE TRIGGER trg_compra_recebimento_estoque
  AFTER UPDATE OF status ON pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION fn_compra_recebimento_estoque();
