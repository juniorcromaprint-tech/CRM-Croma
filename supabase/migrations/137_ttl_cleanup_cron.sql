-- Migration 137: TTL cleanup via pg_cron — estabilidade (evitar crescimento ilimitado)
-- Hardening 2026-04-24
-- system_events: reter 60 dias (tabela mais volumosa — ~150 rows/dia)
-- ai_logs: reter 90 dias (auditoria de uso IA)
-- ai_responses: reter 30 dias (cache de respostas IA)
-- cobranca_automatica com status='enviado': reter 180 dias (histórico de cobrança)

-- ══════════════════════════════════════════════════════════════════
-- Função de limpeza reutilizável
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_ttl_cleanup()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_system_events INT;
  v_ai_logs INT;
  v_ai_responses INT;
BEGIN
  -- system_events > 60 dias
  DELETE FROM system_events
  WHERE created_at < NOW() - INTERVAL '60 days';
  GET DIAGNOSTICS v_system_events = ROW_COUNT;

  -- ai_logs > 90 dias
  DELETE FROM ai_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_ai_logs = ROW_COUNT;

  -- ai_responses > 30 dias
  DELETE FROM ai_responses
  WHERE created_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_ai_responses = ROW_COUNT;

  RETURN jsonb_build_object(
    'system_events_removed', v_system_events,
    'ai_logs_removed', v_ai_logs,
    'ai_responses_removed', v_ai_responses,
    'executed_at', NOW()
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════
-- pg_cron job: roda todo dia às 03:00 UTC (00:00 BRT)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.schedule(
  'ttl-cleanup-diario',
  '0 3 * * *',
  $$SELECT public.fn_ttl_cleanup();$$
);
