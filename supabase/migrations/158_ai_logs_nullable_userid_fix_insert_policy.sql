-- 158 — ai_logs: habilitar logs de chamadas de sistema/serviço + corrigir policy de INSERT
-- Aplicada em 2026-05-21 (migração OpenRouter Onda 1) via Supabase MCP apply_migration.
--
-- Achado #1 da migração: ai_logs estava VAZIO (0 rows em 7 dias).
-- Causa REAL: user_id é NOT NULL sem default, e chamadas de sistema/serviço
-- (whatsapp-webhook, agent-cron-loop, etc.) omitem user_id -> insert violava NOT NULL
-- e era silenciado (sem .select()/erro checado). RLS NÃO era a causa: rls_forced=false
-- -> service_role faz bypass.

ALTER TABLE public.ai_logs ALTER COLUMN user_id DROP NOT NULL;

-- Correção de segurança (plano 1.3 + security-audit 2026-03-24): a policy de INSERT
-- estava aplicada ao role 'public' (anon/authenticated podiam inserir). Restringe a service_role.
DROP POLICY IF EXISTS service_role_insert_logs ON public.ai_logs;
CREATE POLICY service_role_insert_logs ON public.ai_logs
  FOR INSERT TO service_role WITH CHECK (true);
