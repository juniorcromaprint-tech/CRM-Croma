-- Migration 136: Adicionar header X-Internal-Call em TODOS os pg_cron jobs que chamam Edge Functions
-- Hardening 2026-04-24: necessário para que authenticateAndAuthorize() reconheça
-- chamadas inter-service (service_role JWT) e aplique bypass com verificação HMAC.
-- Sem esse header, chamadas de pg_cron falham 401 após o hardening de auth.
-- Jobs afetados: 1, 2 (ai-detectar-problemas), 7, 8 (agent-cron-loop), 12 (mcp-bridge-worker)

-- ══════════════════════════════════════════════════════════════════
-- Job 1: ai-detectar-problemas-manha (0 11 * * 1-5)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.unschedule('ai-detectar-problemas-manha');
SELECT cron.schedule(
  'ai-detectar-problemas-manha',
  '0 11 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/ai-detectar-problemas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key(),
      'X-Internal-Call', 'true'
    ),
    body := '{"mode": "cron"}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════
-- Job 2: ai-detectar-problemas-tarde (0 17 * * 1-5)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.unschedule('ai-detectar-problemas-tarde');
SELECT cron.schedule(
  'ai-detectar-problemas-tarde',
  '0 17 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/ai-detectar-problemas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key(),
      'X-Internal-Call', 'true'
    ),
    body := '{"mode": "cron"}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════
-- Job 7: agent-cron-loop-30min (*/30 11-23,0-2 * * 1-6)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.unschedule('agent-cron-loop-30min');
SELECT cron.schedule(
  'agent-cron-loop-30min',
  '*/30 11-23,0-2 * * 1-6',
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key(),
      'X-Internal-Call', 'true'
    ),
    body := '{"source":"pg_cron","scheduled":true}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════
-- Job 8: resumo-diario-telegram (0 1 * * 2-7)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.unschedule('resumo-diario-telegram');
SELECT cron.schedule(
  'resumo-diario-telegram',
  '0 1 * * 2-7',
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key(),
      'X-Internal-Call', 'true'
    ),
    body := '{"source":"pg_cron","task":"resumo_diario"}'::jsonb
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════
-- Job 12: mcp-bridge-worker-1min (* * * * *)
-- ══════════════════════════════════════════════════════════════════
SELECT cron.unschedule('mcp-bridge-worker-1min');
SELECT cron.schedule(
  'mcp-bridge-worker-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/mcp-bridge-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key(),
      'X-Internal-Call', 'true'
    ),
    body := '{"source":"pg_cron"}'::jsonb
  );
  $$
);
