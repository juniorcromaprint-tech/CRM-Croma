-- Migration 107: pg_cron + pg_net para agendar agent-cron-loop
-- CRON-01 — Agendamento automático do motor de regras
-- Data: 2026-03-31
--
-- NOTA: pg_cron e pg_net precisam ser habilitados no Dashboard do Supabase
-- (Database > Extensions) antes de executar esta migration.
-- Se as extensões não estiverem disponíveis, esta migration será ignorada graciosamente.

-- Habilitar extensões (só funciona se já ativadas no dashboard)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ═══════════════════════════════════════════════════
-- JOB 1: agent-cron-loop a cada 30 minutos (08h-23h, seg-sáb BRT)
-- Motor de regras: cobranças, follow-ups, PCP, alertas
-- ═══════════════════════════════════════════════════

SELECT cron.schedule(
  'agent-cron-loop-30min',
  '*/30 11-23,0-2 * * 1-6',  -- UTC: 11-02 = BRT 08-23 (seg-sáb)
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE'
    ),
    body := '{"source": "pg_cron", "scheduled": true}'::jsonb
  );
  $$
);

-- ═══════════════════════════════════════════════════
-- JOB 2: Detectar pagamentos vencidos (diariamente às 08h BRT = 11h UTC)
-- ═══════════════════════════════════════════════════

SELECT cron.schedule(
  'detect-overdue-payments-daily',
  '0 11 * * *',  -- UTC 11h = BRT 08h
  $$ SELECT fn_detect_overdue_payments(); $$
);

-- ═══════════════════════════════════════════════════
-- JOB 3: Expirar ai_requests antigos (a cada 2 horas)
-- ═══════════════════════════════════════════════════

SELECT cron.schedule(
  'expire-ai-requests',
  '0 */2 * * *',
  $$ SELECT fn_expire_ai_requests(); $$
);

-- ═══════════════════════════════════════════════════
-- JOB 4: Resumo diário via Telegram (22h BRT = 01h UTC dia seguinte)
-- ═══════════════════════════════════════════════════

SELECT cron.schedule(
  'resumo-diario-telegram',
  '0 1 * * 1-6',  -- UTC 01h = BRT 22h (seg-sáb)
  $$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/agent-cron-loop',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjU2OTcsImV4cCI6MjA4ODY0MTY5N30.pi2HDGyXhsoZS0sivfUDzn9z3Qao-6hMKrWBxoQ-1uE'
    ),
    body := '{"source": "pg_cron", "task": "resumo_diario"}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Agendamento de jobs — CROMA 4.0';
