-- Migration 056: triggers automáticos de estoque
-- 1. Custo médio ponderado a cada entrada
-- 2. Reserva automática quando OP inicia produção
-- 3. Baixa automática quando OP finaliza

-- =============================================================
-- Trigger 1: Custo médio automático a cada entrada de estoque
-- =============================================================
CREATE OR REPLACE FUNCTION fn_auto_custo_medio()
RETURNS TRIGGER AS $$
DECLARE
  v_saldo_atual NUMERIC(12,3);
  v_preco_atual NUMERIC(12,4);
  v_novo_preco  NUMERIC(12,4);
BEGIN
  IF NEW.tipo = 'entrada' AND NEW.custo_unitario IS NOT NULL AND NEW.custo_unitario > 0 THEN
    SELECT COALESCE(
      SUM(CASE
        WHEN tipo IN ('entrada','devolucao','liberacao_reserva','ajuste') THEN quantidade
        WHEN tipo IN ('saida','reserva') THEN -quantidade
        ELSE 0
      END), 0
    ) INTO v_saldo_atual
    FROM estoque_movimentacoes
    WHERE material_id = NEW.material_id AND id != NEW.id;

    SELECT COALESCE(preco_medio, 0) INTO v_preco_atual
    FROM materiais WHERE id = NEW.material_id;

    IF (v_saldo_atual + NEW.quantidade) > 0 THEN
      v_novo_preco := (v_saldo_atual * v_preco_atual + NEW.quantidade * NEW.custo_unitario)
                      / (v_saldo_atual + NEW.quantidade);
      UPDATE materiais SET preco_medio = v_novo_preco WHERE id = NEW.material_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_custo_medio ON estoque_movimentacoes;
CREATE TRIGGER trg_auto_custo_medio
  AFTER INSERT ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_auto_custo_medio();

-- =============================================================
-- Trigger 2: OP em_producao → reserva automática de materiais
-- =============================================================
CREATE OR REPLACE FUNCTION fn_auto_reserva_op()
RETURNS TRIGGER AS $$
DECLARE
  v_item RECORD;
  v_modelo_id UUID;
  v_qtd_produto NUMERIC(12,3);
BEGIN
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao') THEN
    SELECT pm.id, COALESCE(pi.quantidade, 1)
    INTO v_modelo_id, v_qtd_produto
    FROM pedido_itens pi
    LEFT JOIN produto_modelos pm ON pm.produto_id = pi.produto_id
    WHERE pi.id = NEW.pedido_item_id
    LIMIT 1;

    IF v_modelo_id IS NOT NULL THEN
      FOR v_item IN
        SELECT mm.material_id,
               mm.quantidade_por_unidade * v_qtd_produto * (1 + COALESCE(mm.percentual_desperdicio, 0)/100.0) AS qtd_reservar
        FROM modelo_materiais mm
        WHERE mm.modelo_id = v_modelo_id
      LOOP
        INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
        VALUES (v_item.material_id, 'reserva', v_item.qtd_reservar, 'ordem_producao', NEW.id, 'Reserva automática — OP ' || COALESCE(NEW.numero, NEW.id::text));

        INSERT INTO estoque_reservas (material_id, ordem_producao_id, quantidade, status)
        VALUES (v_item.material_id, NEW.id, v_item.qtd_reservar, 'ativa');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_reserva_op ON ordens_producao;
CREATE TRIGGER trg_auto_reserva_op
  AFTER INSERT OR UPDATE OF status ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_auto_reserva_op();

-- =============================================================
-- Trigger 3: OP finalizada → baixa automática + libera reservas
-- =============================================================
CREATE OR REPLACE FUNCTION fn_auto_baixa_producao()
RETURNS TRIGGER AS $$
DECLARE
  v_reserva RECORD;
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado') THEN
    FOR v_reserva IN
      SELECT * FROM estoque_reservas
      WHERE ordem_producao_id = NEW.id AND status = 'ativa'
    LOOP
      INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
      VALUES (v_reserva.material_id, 'saida', v_reserva.quantidade, 'ordem_producao', NEW.id, 'Baixa automática — OP ' || COALESCE(NEW.numero, NEW.id::text));

      INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
      VALUES (v_reserva.material_id, 'liberacao_reserva', v_reserva.quantidade, 'ordem_producao', NEW.id, 'Liberação reserva — OP ' || COALESCE(NEW.numero, NEW.id::text));

      UPDATE estoque_reservas SET status = 'consumida', consumida_em = NOW() WHERE id = v_reserva.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_baixa_producao ON ordens_producao;
CREATE TRIGGER trg_auto_baixa_producao
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW EXECUTE FUNCTION fn_auto_baixa_producao();
