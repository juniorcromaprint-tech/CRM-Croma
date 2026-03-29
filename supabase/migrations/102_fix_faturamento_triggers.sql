-- Migration 102: Fix faturamento flow triggers
-- Date: 2026-03-28
-- Fixes:
--   1. fn_validar_transicao_status: allow concluido→faturado, add parcialmente_concluido transitions
--   2. fn_auto_gerar_contas_receber: update existing CR on concluido (not ignore), handle faturado
--   3. Remove duplicate trigger trg_pedido_gera_conta_receber (UPDATE)
--   4. fn_sync_pagamento_pedido: new trigger syncs CR payment back to pedido status
--   5. fn_gerar_comissao_auto: improved with external commission support

-- ============================================================
-- 1. Fix status transition validation
-- ============================================================
CREATE OR REPLACE FUNCTION fn_validar_transicao_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP != 'UPDATE' OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'pedidos' THEN
      CASE OLD.status
        WHEN 'rascunho' THEN
          IF NEW.status NOT IN ('aguardando_aprovacao', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aguardando_aprovacao' THEN
          IF NEW.status NOT IN ('aprovado', 'rascunho', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aprovado' THEN
          IF NEW.status NOT IN ('em_producao', 'cancelado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_producao' THEN
          IF NEW.status NOT IN ('produzido', 'parcialmente_concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'produzido' THEN
          IF NEW.status NOT IN ('aguardando_instalacao', 'concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aguardando_instalacao' THEN
          IF NEW.status NOT IN ('em_instalacao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_instalacao' THEN
          IF NEW.status NOT IN ('parcialmente_concluido', 'concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'parcialmente_concluido' THEN
          IF NEW.status NOT IN ('em_producao', 'concluido') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'concluido' THEN
          IF NEW.status NOT IN ('faturado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'faturado' THEN
          RAISE EXCEPTION 'Pedido faturado nao pode mudar de status';
        WHEN 'cancelado' THEN
          RAISE EXCEPTION 'Pedido cancelado nao pode mudar de status';
        ELSE NULL;
      END CASE;

    WHEN 'propostas' THEN
      CASE OLD.status
        WHEN 'rascunho' THEN
          IF NEW.status NOT IN ('enviada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'enviada' THEN
          IF NEW.status NOT IN ('em_revisao', 'aprovada', 'recusada', 'expirada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_revisao' THEN
          IF NEW.status NOT IN ('rascunho', 'enviada') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'aprovada' THEN
          RAISE EXCEPTION 'Proposta aprovada nao pode mudar de status';
        WHEN 'recusada' THEN
          IF NEW.status NOT IN ('rascunho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'expirada' THEN
          IF NEW.status NOT IN ('rascunho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        ELSE NULL;
      END CASE;

    WHEN 'ordens_producao' THEN
      CASE OLD.status
        WHEN 'aguardando_programacao' THEN
          IF NEW.status NOT IN ('em_fila') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_fila' THEN
          IF NEW.status NOT IN ('em_producao', 'aguardando_programacao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_producao' THEN
          IF NEW.status NOT IN ('em_acabamento', 'em_conferencia', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_acabamento' THEN
          IF NEW.status NOT IN ('em_conferencia', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'em_conferencia' THEN
          IF NEW.status NOT IN ('liberado', 'retrabalho') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'liberado' THEN
          IF NEW.status NOT IN ('finalizado') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'retrabalho' THEN
          IF NEW.status NOT IN ('em_producao') THEN
            RAISE EXCEPTION 'Transicao invalida: % -> %', OLD.status, NEW.status;
          END IF;
        WHEN 'finalizado' THEN
          RAISE EXCEPTION 'OP finalizada nao pode mudar de status';
        ELSE NULL;
      END CASE;

    ELSE NULL;
  END CASE;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Unified contas_receber trigger (handles concluido + faturado)
-- ============================================================
CREATE OR REPLACE FUNCTION fn_auto_gerar_contas_receber()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE v_valor numeric; v_descricao text; v_existing_id uuid;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  -- CONCLUIDO: create or upgrade CR to a_vencer
  IF NEW.status = 'concluido' THEN
    v_valor := COALESCE(NEW.valor_total, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;
    v_descricao := 'Pedido ' || COALESCE(NEW.numero, NEW.id::text);

    SELECT id INTO v_existing_id FROM contas_receber WHERE pedido_id = NEW.id LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE contas_receber
      SET status = 'a_vencer',
          valor_original = v_valor,
          saldo = v_valor,
          data_emissao = CURRENT_DATE,
          data_vencimento = CURRENT_DATE + interval '30 days',
          updated_at = now()
      WHERE id = v_existing_id AND status = 'previsto';
    ELSE
      INSERT INTO contas_receber (pedido_id, cliente_id, valor_original, saldo, status, data_emissao, data_vencimento, observacoes)
      VALUES (NEW.id, NEW.cliente_id, v_valor, v_valor, 'a_vencer', CURRENT_DATE, CURRENT_DATE + interval '30 days', v_descricao);
    END IF;
  END IF;

  -- FATURADO: update CR to emitido
  IF NEW.status = 'faturado' THEN
    UPDATE contas_receber
    SET status = 'emitido',
        updated_at = now()
    WHERE pedido_id = NEW.id AND status IN ('a_vencer', 'previsto');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_auto_gerar_contas_receber falhou para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 3. Remove duplicate UPDATE trigger (keep INSERT trigger)
-- ============================================================
DROP TRIGGER IF EXISTS trg_pedido_gera_conta_receber ON pedidos;

-- ============================================================
-- 4. New: sync CR payment → pedido faturado
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sync_pagamento_pedido()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pedido_id uuid;
  v_total_crs integer;
  v_pagas integer;
BEGIN
  IF NEW.status <> 'pago' OR OLD.status = 'pago' THEN RETURN NEW; END IF;

  v_pedido_id := NEW.pedido_id;
  IF v_pedido_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.saldo > 0 THEN
    NEW.saldo := 0;
    NEW.valor_pago := NEW.valor_original;
  END IF;
  IF NEW.data_pagamento IS NULL THEN
    NEW.data_pagamento := CURRENT_DATE;
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pago')
  INTO v_total_crs, v_pagas
  FROM contas_receber
  WHERE pedido_id = v_pedido_id AND excluido_em IS NULL AND id != NEW.id;

  v_total_crs := v_total_crs + 1;
  v_pagas := v_pagas + 1;

  IF v_total_crs = v_pagas THEN
    UPDATE pedidos
    SET status = 'faturado'
    WHERE id = v_pedido_id AND status = 'concluido';
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_sync_pagamento_pedido falhou para CR %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pagamento_pedido ON contas_receber;
CREATE TRIGGER trg_sync_pagamento_pedido
BEFORE UPDATE OF status ON contas_receber
FOR EACH ROW
EXECUTE FUNCTION fn_sync_pagamento_pedido();

-- ============================================================
-- 5. Improved comissao trigger with external commission
-- ============================================================
CREATE OR REPLACE FUNCTION fn_gerar_comissao_auto()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_valor_base numeric;
  v_vendedor_id uuid;
  v_percentual numeric := 5.0;
  v_proposta record;
BEGIN
  IF NEW.status <> 'faturado' OR OLD.status = 'faturado' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM comissoes WHERE pedido_id = NEW.id AND excluido_em IS NULL) THEN RETURN NEW; END IF;

  v_valor_base := COALESCE(NEW.valor_total, 0);
  v_vendedor_id := NEW.vendedor_id;

  IF v_vendedor_id IS NULL OR v_valor_base <= 0 THEN RETURN NEW; END IF;

  IF NEW.proposta_id IS NOT NULL THEN
    SELECT comissao_externa_pct, comissionado_externo_id, absorver_comissao
    INTO v_proposta
    FROM propostas WHERE id = NEW.proposta_id;
  END IF;

  -- Internal vendedor commission (5%)
  INSERT INTO comissoes (pedido_id, vendedor_id, valor_base, valor_comissao, percentual, status, tipo_comissionado, created_at)
  VALUES (NEW.id, v_vendedor_id, v_valor_base, v_valor_base * v_percentual / 100, v_percentual, 'pendente', 'vendedor', now())
  ON CONFLICT DO NOTHING;

  -- External commission if configured in proposta
  IF v_proposta IS NOT NULL AND v_proposta.comissionado_externo_id IS NOT NULL AND COALESCE(v_proposta.comissao_externa_pct, 0) > 0 THEN
    INSERT INTO comissoes (pedido_id, vendedor_id, valor_base, valor_comissao, percentual, status, tipo_comissionado, absorver_comissao, created_at)
    VALUES (
      NEW.id,
      v_proposta.comissionado_externo_id,
      v_valor_base,
      v_valor_base * v_proposta.comissao_externa_pct / 100,
      v_proposta.comissao_externa_pct,
      'pendente',
      'externo',
      COALESCE(v_proposta.absorver_comissao, false),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao gerar comissao para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
