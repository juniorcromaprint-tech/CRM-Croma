-- SEC-001: fecha exposicao ANON (RLS). Aplicada via MCP 2026-05-29 (sessao monitor, autorizada Junior).
-- ANTES (provado SET ROLE anon): anon lia leads=3460, clientes=336, ai_alertas=357 via policies TO public USING(true).
-- DEPOIS (validado): SET ROLE anon -> leads/clientes/ai_alertas = 0; SET ROLE authenticated -> leads=3460, clientes=336 (app logado intacto).
-- Reversivel: recriar as policies TO public.
-- Origem: planning/SEC-001-remediacao-anon-rls-VALIDADA.sql (#37) + de-risk #40 (nenhuma rota pre-login le via anon). Blocos 1+2 (SAFE).

-- BLOCO 1 — leads + clientes (PII): SELECT restrito a authenticated
DROP POLICY IF EXISTS leads_all_read ON public.leads;
CREATE POLICY leads_all_read ON public.leads FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS clientes_all_read ON public.clientes;
CREATE POLICY clientes_all_read ON public.clientes FOR SELECT TO authenticated USING (true);

-- BLOCO 2 — ai_alertas: remove policy ALL/public/USING(true) (vetor anon).
-- authenticated mantem via authenticated_read_alertas (SELECT) + authenticated_resolve_alertas (UPDATE); service_role bypassa RLS.
DROP POLICY IF EXISTS service_role_manage_alertas ON public.ai_alertas;
