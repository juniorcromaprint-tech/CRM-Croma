-- ============================================================================
-- Versioning migration: fn_installation_completed + trg_installation_completed
-- Ciclo autonomo #31 (rotacao Instalacao) — 2026-05-29
-- Veredicto: DRIFT-LIVE≠MIGRATION
--   Migration 104_ai_bridge_event_triggers.sql tem CREATE FUNCTION mas:
--   1) Sem SECURITY DEFINER (live tem)
--   2) Sem SET search_path (live tem SET search_path TO 'public','pg_temp')
--   3) entity_type='instalacao' no 104 vs entity_type='ordem_instalacao' no live
--   4) payload no 104 nao tem 'cliente_id'; live inclui 'cliente_id'
--   5) Trigger em 104 criado via bloco DO $$ com IF EXISTS guard;
--      live tem trigger normal (sem guard dinamico)
-- ACAO: capturar definicao verbatim do live para source-control.
-- NAO aplicar (no-op de versionagem). NAO mudar logica.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_installation_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('installation_completed', 'ordem_instalacao', NEW.id, jsonb_build_object(
      'pedido_id', NEW.pedido_id,
      'cliente_id', NEW.cliente_id,
      'completed_at', now()
    ));
    UPDATE pedidos SET status = 'instalado', updated_at = now()
    WHERE id = NEW.pedido_id AND status IN ('pronto_instalacao', 'em_instalacao');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_installation_completed ON public.ordens_instalacao;
CREATE TRIGGER trg_installation_completed
  AFTER UPDATE OF status ON public.ordens_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION fn_installation_completed();

COMMENT ON FUNCTION public.fn_installation_completed() IS
  'Versionado verbatim do live — ciclo autonomo #31 — 2026-05-29. '
  'NAO e mudanca de logica. Drift vs migration 104: live tem SECURITY DEFINER '
  '+ SET search_path; entity_type corrigido para ordem_instalacao; payload '
  'inclui cliente_id. Migration 104 nao tinha nada disso.';
