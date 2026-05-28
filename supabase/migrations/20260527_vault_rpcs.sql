-- =============================================================================
-- Migration: 20260527_vault_rpcs.sql
-- Date:      2026-05-27
-- Author:    Junior (CromaCRM) — versionamento retroativo
-- Purpose:
--   Versiona as RPCs `public.get_service_role_legacy_jwt()` e
--   `public.get_telegram_bot_token()` que existiam APENAS no banco
--   (criadas direto no Supabase, sem migration). Sem este arquivo, um
--   restore/recreate do banco perderia a definição.
--
-- Ambas:
--   - SECURITY DEFINER  (executam com privilégios do owner = postgres)
--   - LANGUAGE sql      (corpo simples, sem PL/pgSQL)
--   - Leem de `vault.decrypted_secrets` (extensão Supabase Vault)
--   - search_path explícito (mitiga search_path hijack)
--   - Revogadas de PUBLIC; EXECUTE apenas para service_role
--
-- Idempotência:
--   CREATE OR REPLACE + REVOKE/GRANT são seguros de re-aplicar. A migration
--   pode ser executada N vezes sem efeitos colaterais.
--
-- NÃO aplicar automaticamente — Junior decide quando rodar `apply_migration`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) get_service_role_legacy_jwt()
--    Retorna o JWT legado (service_role anon-key legacy) armazenado no Vault
--    sob o secret name 'service_role_key_legacy_jwt'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_service_role_legacy_jwt()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'vault', 'public'
AS $function$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key_legacy_jwt' LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_service_role_legacy_jwt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_service_role_legacy_jwt() TO service_role;

COMMENT ON FUNCTION public.get_service_role_legacy_jwt() IS
  'Retorna service_role JWT legado do Vault. SECURITY DEFINER. Acesso restrito a service_role.';

-- -----------------------------------------------------------------------------
-- 2) get_telegram_bot_token()
--    Retorna o bot token do Telegram (claudete_bot) armazenado no Vault
--    sob o secret name 'TELEGRAM_BOT_TOKEN'.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_telegram_bot_token()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault'
AS $function$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'TELEGRAM_BOT_TOKEN' LIMIT 1; $function$;

REVOKE ALL ON FUNCTION public.get_telegram_bot_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_telegram_bot_token() TO service_role;

COMMENT ON FUNCTION public.get_telegram_bot_token() IS
  'Retorna Telegram bot token do Vault. SECURITY DEFINER. Acesso restrito a service_role.';

-- =============================================================================
-- Verificação pós-aplicação (rodar manualmente, NÃO faz parte da migration):
--
--   SELECT proname, prosecdef, array_to_string(proacl::text[], ', ')
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND proname IN ('get_service_role_legacy_jwt','get_telegram_bot_token');
--
--   Esperado em ambas:
--     prosecdef = true
--     proacl    = {postgres=X/postgres, service_role=X/postgres}
-- =============================================================================
