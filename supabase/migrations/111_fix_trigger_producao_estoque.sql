-- Migration 111: Corrigir trigger fn_producao_estoque
-- BUG-E2E-05: column mm.quantidade does not exist
-- Fix: modelo_materiais usa quantidade_por_unidade (não quantidade)
-- Fix: estoque_movimentacoes usa motivo (não observacao)

CREATE OR REPLACE FUNCTION fn_producao_estoque()
RETURNS TRIGGER AS $$
BEGIN
  -- OP entra em produção → reserva materiais (apenas se modelo_id definido)
  IF NEW.status = 'em_producao' AND (OLD.status IS NULL OR OLD.status != 'em_producao')
     AND NEW.modelo_id IS NOT NULL THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT
      mm.material_id,
      'reserva',
      mm.quantidade_por_unidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Reserva automática - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;
  END IF;

  -- OP finalizada → libera reserva + saída definitiva
  IF NEW.status = 'finalizado' AND (OLD.status IS NULL OR OLD.status != 'finalizado')
     AND NEW.modelo_id IS NOT NULL THEN
    -- Liberação da reserva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT
      mm.material_id,
      'liberacao_reserva',
      mm.quantidade_por_unidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Liberação reserva - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Saída definitiva
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade_por_unidade * COALESCE(NEW.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Consumo produção - OP #' || NEW.numero
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id;

    -- Atualiza saldos (decrementa)
    UPDATE estoque_saldos es
    SET quantidade = es.quantidade - (mm.quantidade_por_unidade * COALESCE(NEW.quantidade, 1)),
        updated_at = NOW()
    FROM modelo_materiais mm
    WHERE mm.modelo_id = NEW.modelo_id
      AND es.material_id = mm.material_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
