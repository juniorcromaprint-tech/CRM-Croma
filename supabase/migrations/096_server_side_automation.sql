-- Migration 096 — Server-side automation triggers
-- Moves critical side-effects from frontend to database triggers
-- so they execute atomically with the status change.

-- ============================================================
-- TRIGGER 1: Auto-generate contas_receber on pedido 'concluido'
-- ============================================================
-- When a pedido transitions to 'concluido', automatically creates
-- the corresponding contas_receber record. Previously this was
-- orchestrated in the browser — if the tab closed between the
-- status update and the financial record insert, data was lost.

CREATE OR REPLACE FUNCTION fn_auto_gerar_contas_receber()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valor numeric;
  v_descricao text;
BEGIN
  -- Only fire on transition INTO 'concluido'
  IF NEW.status <> 'concluido' OR OLD.status = 'concluido' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if contas_receber already exists for this pedido
  IF EXISTS (
    SELECT 1 FROM contas_receber WHERE pedido_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_valor := COALESCE(NEW.valor_total, 0);

  -- Don't create a zero-value financial record
  IF v_valor <= 0 THEN
    RETURN NEW;
  END IF;

  v_descricao := 'Pedido ' || COALESCE(NEW.numero, NEW.id::text);

  INSERT INTO contas_receber (
    pedido_id,
    cliente_id,
    valor_original,
    saldo,
    status,
    data_emissao,
    data_vencimento,
    observacoes
  ) VALUES (
    NEW.id,
    NEW.cliente_id,
    v_valor,
    v_valor,              -- saldo starts equal to valor_original
    'a_vencer',           -- valid status per CHECK constraint
    CURRENT_DATE,
    CURRENT_DATE + interval '30 days',
    v_descricao
  );

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block the pedido status update due to financial record failure,
  -- but log the error so it appears in Supabase logs for debugging.
  RAISE WARNING 'fn_auto_gerar_contas_receber falhou para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_contas_receber ON pedidos;
CREATE TRIGGER trg_auto_contas_receber
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW EXECUTE FUNCTION fn_auto_gerar_contas_receber();

COMMENT ON FUNCTION fn_auto_gerar_contas_receber() IS
  'Auto-generates contas_receber when pedido transitions to concluido. Idempotent, non-blocking.';


-- ============================================================
-- TRIGGER 2: Fix commission trigger — log errors instead of
-- silently swallowing them (improves on migration 091)
-- ============================================================
-- The original fn_gerar_comissao_auto had a bare EXCEPTION WHEN OTHERS
-- that returned NEW without any logging. This makes debugging impossible.
-- We replace the function keeping the same logic but adding RAISE WARNING.

CREATE OR REPLACE FUNCTION fn_gerar_comissao_auto()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valor_comissao numeric;
  v_valor_base     numeric;
  v_vendedor_id    uuid;
BEGIN
  -- Only fire on transition INTO 'faturado'
  IF NEW.status <> 'faturado' OR OLD.status = 'faturado' THEN
    RETURN NEW;
  END IF;

  -- Idempotency: don't duplicate commission
  IF EXISTS (
    SELECT 1 FROM comissoes WHERE pedido_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_valor_base     := COALESCE(NEW.valor_total, 0);
  v_valor_comissao := v_valor_base * 0.05;
  v_vendedor_id    := NEW.vendedor_id;

  IF v_vendedor_id IS NULL OR v_valor_comissao <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO comissoes (pedido_id, vendedor_id, valor_base, valor_comissao, percentual, status, created_at)
  VALUES (NEW.id, v_vendedor_id, v_valor_base, v_valor_comissao, 5.0, 'pendente', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Don't block the pedido update, but log the error for debugging
  RAISE WARNING 'Falha ao gerar comissao para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- No need to recreate the trigger — it already references fn_gerar_comissao_auto
-- and CREATE OR REPLACE updates the function in place.
