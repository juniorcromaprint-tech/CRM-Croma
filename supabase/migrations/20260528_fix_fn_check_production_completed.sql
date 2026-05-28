-- Ciclo autônomo #18 — fix fn_check_production_completed
-- Bug estrutural descoberto pelo agent paralelo do ciclo #17:
--   - função referenciava `op_etapas` (NÃO EXISTE) — real é `producao_etapas`
--   - status comparado `'concluido'` (masculino) — real é `'concluida'` (feminino)
--   - WHEN clause do trigger também comparava `'concluido'`
-- Evidência: to_regclass('op_etapas')=NULL, COUNT(producao_etapas WHERE status='concluida')=19,
--           COUNT(producao_etapas WHERE status='concluido')=0,
--           system_events.production_completed=0 lifetime
-- Idempotente: CREATE OR REPLACE + DROP IF EXISTS + CREATE TRIGGER

CREATE OR REPLACE FUNCTION public.fn_check_production_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_op_id UUID;
  v_total_etapas INT;
  v_etapas_concluidas INT;
  v_pedido_id UUID;
BEGIN
  v_op_id := NEW.ordem_producao_id;
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluida')
  INTO v_total_etapas, v_etapas_concluidas
  FROM producao_etapas WHERE ordem_producao_id = v_op_id;

  IF v_total_etapas > 0 AND v_total_etapas = v_etapas_concluidas THEN
    UPDATE ordens_producao SET status = 'concluida', updated_at = now()
    WHERE id = v_op_id AND status NOT IN ('concluida', 'finalizado')
    RETURNING pedido_id INTO v_pedido_id;

    IF v_pedido_id IS NOT NULL THEN
      INSERT INTO system_events (event_type, entity_type, entity_id, payload)
      VALUES ('production_completed', 'ordem_producao', v_op_id, jsonb_build_object(
        'pedido_id', v_pedido_id,
        'total_etapas', v_total_etapas,
        'completed_at', now(),
        'fix_ciclo_18', true
      ));
      UPDATE pedidos SET status = 'pronto_instalacao', updated_at = now()
      WHERE id = v_pedido_id AND status = 'em_producao';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Trigger precisa DROP+CREATE pq WHEN clause é compilado em PG
DROP TRIGGER IF EXISTS trg_check_production_completed ON public.producao_etapas;
CREATE TRIGGER trg_check_production_completed
  AFTER UPDATE OF status ON public.producao_etapas
  FOR EACH ROW
  WHEN ((new.status = 'concluida' AND old.status IS DISTINCT FROM 'concluida'))
  EXECUTE FUNCTION public.fn_check_production_completed();

COMMENT ON FUNCTION public.fn_check_production_completed() IS
'Fix ciclo autonomo #18 (2026-05-28): troca op_etapas->producao_etapas e ''concluido''->''concluida''. Bug original deixou cadeia Producao->Instalacao quebrada estruturalmente desde sempre (0 eventos production_completed). Tambem inclui status_finalizado no NOT IN do UPDATE ordens_producao para idempotencia.';
