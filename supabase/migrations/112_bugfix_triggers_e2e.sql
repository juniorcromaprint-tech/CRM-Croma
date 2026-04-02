-- =============================================================
-- Migration 112: Bugfix 4 triggers/functions
-- BUG-E2E-05 | BUG-E2E-06 | BUG-FIN-03 | BUG-ESTOQUE-01
-- Aplicada em: 2026-04-01
-- =============================================================

-- ---------------------------------------------------------------
-- BUG-E2E-05: fn_producao_debita_estoque e debitar_estoque_producao
-- usavam mm.quantidade que não existe em modelo_materiais.
-- Coluna correta: quantidade_por_unidade
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_producao_debita_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'finalizado' AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    INSERT INTO estoque_movimentacoes (
      material_id, tipo, quantidade, motivo, referencia_tipo, referencia_id, created_at
    )
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade_por_unidade * pi.quantidade,
      'Baixa automática - OP ' || NEW.numero,
      'ordem_producao',
      NEW.id,
      NOW()
    FROM pedido_itens pi
    JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
    WHERE pi.pedido_id = NEW.pedido_id
      AND mm.material_id IS NOT NULL
      AND pi.modelo_id IS NOT NULL;

    UPDATE estoque_saldos es SET
      quantidade_disponivel = es.quantidade_disponivel - sub.qtd_total,
      updated_at = NOW()
    FROM (
      SELECT
        mm.material_id,
        SUM(mm.quantidade_por_unidade * pi.quantidade) AS qtd_total
      FROM pedido_itens pi
      JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
      WHERE pi.pedido_id = NEW.pedido_id
        AND mm.material_id IS NOT NULL
        AND pi.modelo_id IS NOT NULL
      GROUP BY mm.material_id
    ) sub
    WHERE es.material_id = sub.material_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Also fix debitar_estoque_producao (same bug)
CREATE OR REPLACE FUNCTION debitar_estoque_producao()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('finalizado', 'concluido') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO estoque_movimentacoes (material_id, tipo, quantidade, referencia_tipo, referencia_id, motivo)
    SELECT
      mm.material_id,
      'saida',
      mm.quantidade_por_unidade * COALESCE(pi.quantidade, 1),
      'ordem_producao',
      NEW.id,
      'Baixa automática - OP ' || COALESCE(NEW.numero, NEW.id::text)
    FROM pedido_itens pi
    JOIN modelo_materiais mm ON mm.modelo_id = pi.modelo_id
    WHERE pi.id = NEW.pedido_item_id
      AND mm.material_id IS NOT NULL
      AND pi.modelo_id IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------
-- BUG-E2E-06: trg_pedido_insert_conta_receber era BEFORE INSERT
-- mas aprovação via MCP faz UPDATE — trigger nunca disparava.
-- Fix: recriar fn_pedido_gera_conta_receber com idempotência e
-- criar trigger AFTER UPDATE no lugar do BEFORE INSERT.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_pedido_gera_conta_receber()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    -- Idempotência: não criar CR duplicada
    IF NOT EXISTS (SELECT 1 FROM contas_receber WHERE pedido_id = NEW.id) THEN
      INSERT INTO contas_receber (
        numero_titulo, valor_original, saldo, data_vencimento,
        data_emissao, cliente_id, pedido_id, status
      )
      VALUES (
        'PED-' || NEW.numero,
        NEW.valor_total,
        NEW.valor_total,
        CURRENT_DATE + INTERVAL '30 days',
        CURRENT_DATE,
        NEW.cliente_id,
        NEW.id,
        'previsto'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Remover trigger antigo (BEFORE INSERT) e criar AFTER UPDATE
DROP TRIGGER IF EXISTS trg_pedido_insert_conta_receber ON pedidos;

CREATE TRIGGER trg_pedido_aprovado_conta_receber
  AFTER UPDATE ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_pedido_gera_conta_receber();

-- ---------------------------------------------------------------
-- BUG-FIN-03: fn_payment_received usava NEW.valor que não existe.
-- Coluna correta: valor_original (valor_pago também incluído no payload)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_payment_received()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('payment_received', 'conta_receber', NEW.id, jsonb_build_object(
      'pedido_id', NEW.pedido_id,
      'valor', NEW.valor_original,
      'valor_pago', NEW.valor_pago,
      'cliente_id', NEW.cliente_id,
      'paid_at', now()
    ));
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------
-- BUG-ESTOQUE-01: estoque_movimentacoes não tinha trigger para
-- atualizar estoque_saldos após INSERT — saldo permanecia 0.
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_atualiza_saldo_estoque()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta NUMERIC;
BEGIN
  v_delta := CASE
    WHEN NEW.tipo IN ('entrada', 'ajuste_positivo') THEN NEW.quantidade
    WHEN NEW.tipo IN ('saida', 'ajuste_negativo', 'liberacao_reserva') THEN -NEW.quantidade
    ELSE 0
  END;

  IF v_delta = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO estoque_saldos (material_id, quantidade_disponivel, quantidade_reservada, updated_at)
  VALUES (NEW.material_id, v_delta, 0, NOW())
  ON CONFLICT (material_id) DO UPDATE
    SET quantidade_disponivel = estoque_saldos.quantidade_disponivel + EXCLUDED.quantidade_disponivel,
        updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualiza_saldo_estoque ON estoque_movimentacoes;
CREATE TRIGGER trg_atualiza_saldo_estoque
  AFTER INSERT ON estoque_movimentacoes
  FOR EACH ROW EXECUTE FUNCTION fn_atualiza_saldo_estoque();
