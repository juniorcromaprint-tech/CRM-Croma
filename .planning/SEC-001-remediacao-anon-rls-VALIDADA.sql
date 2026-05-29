-- ============================================================================
-- SEC-001 — Remediação da exposição ANON (RLS)
-- Ciclo autônomo #37 — 2026-05-29 — [VALIDADA contra pg_policies real, NÃO APLICADA]
-- ----------------------------------------------------------------------------
-- CONTEXTO: anon tem GRANT ALL em todas as tabelas (default Supabase) -> RLS é o
-- único gate. Estas tabelas têm policy `TO public USING(true)` => anon lê tudo.
-- PROVADO via SET ROLE anon: leads=3460, clientes=336, ai_alertas=357,
-- telegram_messages=42, produtos=107, regras_precificacao=11 visíveis ao anon.
--
-- ⚠️ APLICAR SÓ EM JANELA MONITORADA, após confirmar que NENHUMA página anon
--    (pré-login) do ERP/portal lê estas tabelas via anon key. Idempotente
--    (DROP IF EXISTS + CREATE). Rodar bloco-a-bloco, validando o app após cada um.
-- ============================================================================

-- ── BLOCO 1 — SAFE (PII): leads + clientes ──────────────────────────────────
-- authenticated continua com leitura full (única policy SELECT da tabela);
-- anon perde acesso. Reversível (recriar TO public).
DROP POLICY IF EXISTS leads_all_read ON public.leads;
CREATE POLICY leads_all_read ON public.leads
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS clientes_all_read ON public.clientes;
CREATE POLICY clientes_all_read ON public.clientes
  FOR SELECT TO authenticated USING (true);

-- ── BLOCO 2 — SAFE: ai_alertas (policy mal nomeada) ─────────────────────────
-- service_role bypassa RLS (não precisa de policy). authenticated mantém acesso
-- via authenticated_read_alertas (SELECT) + authenticated_resolve_alertas (UPDATE).
-- Esta policy ALL/public/USING(true) só servia pra expor anon. DROP fecha o buraco.
DROP POLICY IF EXISTS service_role_manage_alertas ON public.ai_alertas;

-- ============================================================================
-- ⛔ ABAIXO = NEEDS-CONFIRM (não rodar sem checar o app antes)
-- ============================================================================

-- ── telegram_messages ──────────────────────────────────────────────────────
-- service_role_full_telegram_messages é a ÚNICA policy da tabela. service_role
-- bypassa RLS, mas se o ERP lê telegram_messages como `authenticated`, dropar
-- trava a leitura logada. CONFIRMAR e, se preciso, criar policy authenticated:
-- DROP POLICY IF EXISTS service_role_full_telegram_messages ON public.telegram_messages;
-- CREATE POLICY tg_msgs_auth_read ON public.telegram_messages FOR SELECT TO authenticated USING (true);

-- ── nps_respostas ───────────────────────────────────────────────────────────
-- "by_token" mas USING(true) (sem checagem). UPDATE-any é perigoso. Gatear por
-- token (ex.: header/param via current_setting) OU restringir a authenticated.
-- Tabela vazia hoje (0 rows) => baixa urgência, mas corrigir antes de popular.
-- DROP POLICY IF EXISTS nps_public_update_by_token ON public.nps_respostas;

-- ── catálogo/preços (portal anon pode renderizar proposta) ──────────────────
-- CONFIRMAR se o portal-cliente (anon) lê catálogo pra montar a proposta. Se
-- NÃO, tightening recomendado (intel de custo/markup não deve vazar):
--   produtos, produto_modelos, categorias_produto, modelo_materiais,
--   modelo_processos, regras_precificacao, faixas_quantidade, maquinas,
--   orcamento_item_maquinas, materiais_historico_preco
-- Padrão por tabela:
--   DROP POLICY IF EXISTS <policy_select_public> ON public.<tab>;
--   CREATE POLICY <policy_select_public> ON public.<tab> FOR SELECT TO authenticated USING (true);

-- ── alertas_telegram_dedup (única RLS OFF) ──────────────────────────────────
-- Interna (trigger/Edge via service_role). Hardening defense-in-depth:
-- ALTER TABLE public.alertas_telegram_dedup ENABLE ROW LEVEL SECURITY;
-- (service_role não é afetado; sem policy = anon/authenticated bloqueados)

-- ── Validação pós-aplicação (rodar como anon) ───────────────────────────────
-- SET ROLE anon;
-- SELECT count(*) FROM public.leads;     -- esperado: 0
-- SELECT count(*) FROM public.clientes;  -- esperado: 0
-- RESET ROLE;
