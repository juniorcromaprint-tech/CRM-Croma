-- SEC-002: revoga EXECUTE de anon em funcoes SECURITY DEFINER perigosas. Aplicada via MCP 2026-05-29 (sessao monitor, autorizada Junior).
-- PROVADO (SET ROLE anon): anon lia clientes via execute_sql_readonly (dribla RLS) + executava vault_read_secret (le cofre).
-- service_role/postgres mantem (uso interno via Edges). App Campo nao afetado (100% authenticated, zero .rpc()). Reversivel.
-- VALIDADO pos-aplicacao: anon perdeu as 4 criticas + ~22 internas; so portal_* (9) e helpers de auth/RLS (4) seguem com anon.

-- ── 4 criticas (cofre, SQL arbitrario, backup pessoal) ──
REVOKE EXECUTE ON FUNCTION public.vault_read_secret(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vault_upsert_secret(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.backup_pessoal_table(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.execute_sql_readonly(text) FROM anon, PUBLIC;  -- authenticated mantem (AISidebar/ERP)

-- ── Lote 2 (SEC-002b): demais SECDEF internas (jobs/fiscal/cobranca/escrita/dados) ──
-- O EXECUTE de anon vinha de PUBLIC -> REVOKE FROM anon sozinho NAO bastava. Correto: REVOKE FROM PUBLIC + GRANT explicito.
-- Preserva portal_* (cliente via token) + helpers de auth/RLS (usados dentro de policies).
-- authenticated + service_role mantidos => ERP, App Campo e cron intactos.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
    WHERE nsp.nspname = 'public' AND p.prosecdef = true AND p.prorettype <> 'trigger'::regtype
      AND p.proname NOT LIKE 'portal_%'
      AND p.proname NOT IN ('get_user_role','is_admin','is_role','user_has_module_access',
                            'vault_read_secret','vault_upsert_secret','backup_pessoal_table','execute_sql_readonly')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role', r.proname, r.args);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'SEC-002b: % funcoes (anon revogado via PUBLIC; authenticated+service_role mantidos)', n;
END $$;
