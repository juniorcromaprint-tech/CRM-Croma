-- ============================================================================
-- Versioning migration: fn_sync_job_to_ordem + trg_sync_job_to_ordem
-- Ciclo autonomo #31 (rotacao Instalacao) — 2026-05-29
-- Veredicto: DRIFT-LIVE≠MIGRATION
--   Migration 004_integracao_bridge.sql tem CREATE FUNCTION mas SEM
--   SECURITY DEFINER e SEM SET search_path. Live tem ambos.
--   Corpo logico identico (whitespace normalizado).
-- ACAO: capturar definicao verbatim do live para source-control.
-- NAO aplicar (no-op de versionagem). NAO mudar logica.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_sync_job_to_ordem()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.ordem_instalacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Quando job é concluído, marca a ordem de instalação como concluída
  IF NEW.status = 'Concluído' AND (OLD.status IS NULL OR OLD.status != 'Concluído') THEN
    UPDATE ordens_instalacao
    SET status = 'concluida',
        data_execucao = CURRENT_DATE,
        updated_at = NOW()
    WHERE id = NEW.ordem_instalacao_id;

    -- Atualizar status do item do pedido se existir
    IF NEW.pedido_id IS NOT NULL AND NEW.pedido_item_id IS NOT NULL THEN
      UPDATE pedido_itens
      SET status = 'instalado'
      WHERE pedido_id = NEW.pedido_id
        AND id = NEW.pedido_item_id;
    END IF;
  END IF;

  -- Quando job está em andamento, marca a ordem como em execução
  IF NEW.status = 'Em Andamento' AND (OLD.status IS NULL OR OLD.status != 'Em Andamento') THEN
    UPDATE ordens_instalacao
    SET status = 'em_execucao',
        updated_at = NOW()
    WHERE id = NEW.ordem_instalacao_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_job_to_ordem ON public.jobs;
CREATE TRIGGER trg_sync_job_to_ordem
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_job_to_ordem();

COMMENT ON FUNCTION public.fn_sync_job_to_ordem() IS
  'Versionado verbatim do live — ciclo autonomo #31 — 2026-05-29. '
  'NAO e mudanca de logica. Drift detectado: migration 004 carecia de '
  'SECURITY DEFINER + SET search_path que existem no live.';
