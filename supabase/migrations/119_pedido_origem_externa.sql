-- ============================================================================
-- Migration 119: Pedidos espelhados de sistema externo (Mubisys, etc)
-- ============================================================================
-- Adiciona suporte a pedidos importados/espelhados de sistemas externos
-- (ex: OSs do Mubisys que continuam sendo faturadas la ate a migracao
-- completa). Esses pedidos NAO devem disparar geracao automatica de
-- contas a receber, ordens de producao ou comissoes.
--
-- Campos novos em public.pedidos:
--   - origem_externa       TEXT    NULL        -- 'mubisys','importacao','api',NULL=nativo
--   - skip_auto_cr         BOOLEAN DEFAULT F   -- bypassa triggers de CR
--   - skip_auto_op         BOOLEAN DEFAULT F   -- bypassa trigger de OP
--   - skip_auto_comissao   BOOLEAN DEFAULT F   -- bypassa trigger de comissao
-- ============================================================================

BEGIN;

-- 1) Novas colunas -----------------------------------------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origem_externa       TEXT    NULL,
  ADD COLUMN IF NOT EXISTS skip_auto_cr         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_auto_op         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS skip_auto_comissao   BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.pedidos.origem_externa     IS 'Sistema de origem quando o pedido eh espelhado (ex: mubisys). NULL = nativo.';
COMMENT ON COLUMN public.pedidos.skip_auto_cr       IS 'Se true, desliga geracao automatica de contas a receber.';
COMMENT ON COLUMN public.pedidos.skip_auto_op       IS 'Se true, desliga geracao automatica de ordens de producao.';
COMMENT ON COLUMN public.pedidos.skip_auto_comissao IS 'Se true, desliga geracao automatica de comissao.';

CREATE INDEX IF NOT EXISTS idx_pedidos_origem_externa
  ON public.pedidos (origem_externa)
  WHERE origem_externa IS NOT NULL;

-- 2) Trigger BEFORE INSERT: auto-seta skips quando origem_externa vem ------
CREATE OR REPLACE FUNCTION public.fn_pedido_origem_externa_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.origem_externa IS NOT NULL AND length(trim(NEW.origem_externa)) > 0 THEN
    IF NEW.skip_auto_cr       IS NULL OR NEW.skip_auto_cr       = false THEN NEW.skip_auto_cr       := true; END IF;
    IF NEW.skip_auto_op       IS NULL OR NEW.skip_auto_op       = false THEN NEW.skip_auto_op       := true; END IF;
    IF NEW.skip_auto_comissao IS NULL OR NEW.skip_auto_comissao = false THEN NEW.skip_auto_comissao := true; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedido_origem_externa_defaults ON public.pedidos;
CREATE TRIGGER trg_pedido_origem_externa_defaults
  BEFORE INSERT ON public.pedidos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_pedido_origem_externa_defaults();

-- 3.1) fn_auto_gerar_contas_receber (concluido/faturado -> CR)
CREATE OR REPLACE FUNCTION public.fn_auto_gerar_contas_receber()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_valor numeric; v_descricao text; v_existing_id uuid;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF COALESCE(NEW.skip_auto_cr, false) THEN RETURN NEW; END IF;
  IF NEW.status = 'concluido' THEN
    v_valor := COALESCE(NEW.valor_total, 0);
    IF v_valor <= 0 THEN RETURN NEW; END IF;
    v_descricao := 'Pedido ' || COALESCE(NEW.numero, NEW.id::text);
    SELECT id INTO v_existing_id FROM contas_receber WHERE pedido_id = NEW.id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      UPDATE contas_receber SET status='a_vencer', valor_original=v_valor, saldo=v_valor,
        data_emissao=CURRENT_DATE, data_vencimento=CURRENT_DATE+interval '30 days', updated_at=now()
      WHERE id=v_existing_id AND status='previsto';
    ELSE
      INSERT INTO contas_receber (pedido_id,cliente_id,valor_original,saldo,status,data_emissao,data_vencimento,observacoes)
      VALUES (NEW.id,NEW.cliente_id,v_valor,v_valor,'a_vencer',CURRENT_DATE,CURRENT_DATE+interval '30 days',v_descricao);
    END IF;
  END IF;
  IF NEW.status = 'faturado' THEN
    UPDATE contas_receber SET status='emitido', updated_at=now()
    WHERE pedido_id=NEW.id AND status IN ('a_vencer','previsto');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_auto_gerar_contas_receber falhou para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 3.2) fn_pedido_gera_conta_receber (aprovado -> CR previsto)
CREATE OR REPLACE FUNCTION public.fn_pedido_gera_conta_receber()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF COALESCE(NEW.skip_auto_cr, false) THEN RETURN NEW; END IF;
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    IF NOT EXISTS (SELECT 1 FROM contas_receber WHERE pedido_id = NEW.id) THEN
      INSERT INTO contas_receber (numero_titulo, valor_original, saldo, data_vencimento, data_emissao, cliente_id, pedido_id, status)
      VALUES ('PED-' || NEW.numero, NEW.valor_total, NEW.valor_total, CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE, NEW.cliente_id, NEW.id, 'previsto');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3.3) fn_pedido_aprovado_cria_op (aprovado -> OPs)
CREATE OR REPLACE FUNCTION public.fn_pedido_aprovado_cria_op()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_item RECORD; v_item_count INT; v_op_count INT; v_ops_criadas INT := 0;
BEGIN
  IF NEW.status != 'aprovado' OR OLD.status = 'aprovado' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.skip_auto_op, false) THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO v_item_count FROM pedido_itens WHERE pedido_id = NEW.id AND status != 'cancelado';
  IF v_item_count = 0 THEN RETURN NEW; END IF;
  FOR v_item IN SELECT pi.id AS pedido_item_id, pi.descricao, pi.quantidade FROM pedido_itens pi WHERE pi.pedido_id = NEW.id AND pi.status != 'cancelado'
  LOOP
    SELECT COUNT(*) INTO v_op_count FROM ordens_producao WHERE pedido_item_id = v_item.pedido_item_id;
    IF v_op_count = 0 THEN
      INSERT INTO ordens_producao (pedido_id, pedido_item_id, status, prioridade, observacoes)
      VALUES (NEW.id, v_item.pedido_item_id, 'aguardando_programacao',
        CASE NEW.prioridade WHEN 'urgente' THEN 3 WHEN 'alta' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END,
        'OP gerada automaticamente - Pedido ' || COALESCE(NEW.numero, NEW.id::TEXT));
      v_ops_criadas := v_ops_criadas + 1;
    END IF;
  END LOOP;
  UPDATE pedidos SET status = 'em_producao', updated_at = NOW() WHERE id = NEW.id AND status = 'aprovado';
  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES ('pedidos', NEW.id, 'STATUS_CHANGE', jsonb_build_object('evento','pedido_aprovado_criou_op','pedido',NEW.numero,'itens',v_item_count,'ops_criadas',v_ops_criadas));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING '[099-T1] Erro: %', SQLERRM; RETURN NEW;
END;
$function$;

-- 3.4) fn_gerar_comissao_auto (faturado -> comissao)
CREATE OR REPLACE FUNCTION public.fn_gerar_comissao_auto()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_valor_base numeric; v_vendedor_id uuid; v_percentual numeric := 5.0; v_proposta record;
BEGIN
  IF NEW.status <> 'faturado' OR OLD.status = 'faturado' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.skip_auto_comissao, false) THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM comissoes WHERE pedido_id=NEW.id AND excluido_em IS NULL) THEN RETURN NEW; END IF;
  v_valor_base := COALESCE(NEW.valor_total, 0);
  v_vendedor_id := NEW.vendedor_id;
  IF v_vendedor_id IS NULL OR v_valor_base <= 0 THEN RETURN NEW; END IF;
  IF NEW.proposta_id IS NOT NULL THEN
    SELECT comissao_externa_pct, comissionado_externo_id, absorver_comissao INTO v_proposta FROM propostas WHERE id=NEW.proposta_id;
  END IF;
  INSERT INTO comissoes (pedido_id,vendedor_id,valor_base,valor_comissao,percentual,status,tipo_comissionado,created_at)
  VALUES (NEW.id,v_vendedor_id,v_valor_base,v_valor_base*v_percentual/100,v_percentual,'pendente','vendedor',now())
  ON CONFLICT DO NOTHING;
  IF v_proposta IS NOT NULL AND v_proposta.comissionado_externo_id IS NOT NULL AND COALESCE(v_proposta.comissao_externa_pct,0) > 0 THEN
    INSERT INTO comissoes (pedido_id,vendedor_id,valor_base,valor_comissao,percentual,status,tipo_comissionado,absorver_comissao,created_at)
    VALUES (NEW.id,v_proposta.comissionado_externo_id,v_valor_base,v_valor_base*v_proposta.comissao_externa_pct/100,v_proposta.comissao_externa_pct,'pendente','externo',COALESCE(v_proposta.absorver_comissao,false),now())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Falha ao gerar comissao para pedido %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$function$;

-- 4) Backfill: marcar pedido 1069 (CALCADOS BEIRA RIO) como espelhado ------
UPDATE public.pedidos
SET origem_externa     = 'mubisys',
    skip_auto_cr       = true,
    skip_auto_op       = true,
    skip_auto_comissao = true
WHERE numero = '1069'
  AND origem_externa IS NULL;

COMMIT;
