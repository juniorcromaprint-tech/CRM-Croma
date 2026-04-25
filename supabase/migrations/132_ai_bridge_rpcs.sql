-- Migration 132: RPCs atômicas para o mcp-bridge-worker
-- Extraído da produção em 2026-04-24 (código fantasma — existia no banco mas não no repo)
-- fn_claim_ai_requests: locking atômico com FOR UPDATE SKIP LOCKED
-- fn_expire_ai_requests: expira requests pendentes que passaram do TTL

-- ══════════════════════════════════════════════════════════════════
-- fn_claim_ai_requests — claim atômico de ai_requests pendentes
-- Usado pelo mcp-bridge-worker v3 para evitar race conditions
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_claim_ai_requests(p_limit integer DEFAULT 10)
 RETURNS SETOF ai_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  UPDATE ai_requests SET status = 'processing'
  WHERE id IN (
    SELECT id FROM ai_requests
    WHERE status = 'pending'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
END;
$function$;

-- ══════════════════════════════════════════════════════════════════
-- fn_expire_ai_requests — expira requests que passaram do expires_at
-- Chamado pelo pg_cron ou manualmente para limpeza
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.fn_expire_ai_requests()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE ai_requests SET status = 'expired'
  WHERE status = 'pending' AND expires_at < now();
END;
$function$;
