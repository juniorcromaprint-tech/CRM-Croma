-- =============================================================================
-- MIGRATION 20260527 — STORAGE: restringir policy `portal_uploads_insert_anon`
-- Projeto: djwjmfgplnqyffdcgdaw
-- Data: 2026-05-27
-- =============================================================================
-- CONTEXTO
--   A policy original (migration 033) permitia qualquer anon fazer INSERT em
--   QUALQUER path dentro do bucket `proposta-uploads`:
--
--     WITH CHECK (bucket_id = 'proposta-uploads')
--
--   Isso abre vetor de spam/abuso/custo: qualquer cliente anon pode subir
--   arquivo arbitrário (qualquer tamanho até o limite do bucket, qualquer
--   nome) e ocupar storage sem nenhum vinculo com proposta.
--
-- FIX
--   Restringir o WITH CHECK pra aceitar SOMENTE os prefixos legitimos do
--   portal do cliente:
--     - `assinaturas/%`  -> Edge Function `portal-upload-assinatura` faz
--                          upload em `assinaturas/{proposta_id}/assinatura.png`
--                          via service_role (bypassa RLS), MAS o frontend
--                          tambem usa anon pra o caso de upload direto
--                          futuro (defesa em profundidade).
--     - `briefings/%`    -> reservado pra uploads de briefings pelo cliente
--                          (planejado, ainda nao implementado, mas deixado
--                          aberto pra nao precisar de nova migration depois).
--
-- IDEMPOTENCIA
--   DROP POLICY IF EXISTS  + DROP da nova-policy-IF-EXISTS antes do CREATE.
--   Pode rodar N vezes sem erro.
--
-- COMO APLICAR
--   storage.objects e owned by `supabase_storage_admin`. O role `postgres`
--   (usado pelo Supabase MCP / `psql` direto) NAO tem essa membership e por
--   isso CREATE/ALTER POLICY falha com 42501 "must be owner of relation
--   objects". O DROP IF EXISTS funciona porque o privileged_role membership
--   permite removal mesmo sem ownership.
--
--   Aplicar de UMA das formas abaixo:
--     a) Supabase CLI (`supabase db push`) - conecta como supabase_admin;
--     b) Dashboard > Storage > Policies (cole o SQL via "Custom Policy");
--     c) Connection string do `supabase_admin` (only via service ops).
--
--   Aplicado parcialmente em 2026-05-27 via execute_sql:
--     - DROP da policy permissiva: OK
--     - CREATE da restritiva: FALHOU (42501) - pendente aplicar via CLI/UI.
--
--   Estado atual (apos DROP): RLS deny-by-default impede QUALQUER INSERT
--   anon em proposta-uploads. Edge Function `portal-upload-assinatura` usa
--   service_role e segue funcionando normalmente (bypassa RLS).
-- =============================================================================

BEGIN;

-- 1) Remove a policy permissiva original.
DROP POLICY IF EXISTS portal_uploads_insert_anon ON storage.objects;

-- 2) Remove a versao restritiva (idempotencia em re-runs).
DROP POLICY IF EXISTS portal_uploads_insert_anon_restricted ON storage.objects;

-- 3) Cria a versao restritiva: anon so pode inserir em paths whitelisted.
CREATE POLICY portal_uploads_insert_anon_restricted
  ON storage.objects
  FOR INSERT
  TO anon
  WITH CHECK (
    bucket_id = 'proposta-uploads'
    AND (
      name LIKE 'assinaturas/%'
      OR name LIKE 'briefings/%'
    )
  );

COMMENT ON POLICY portal_uploads_insert_anon_restricted ON storage.objects IS
  'Portal anon: INSERT permitido apenas em assinaturas/% e briefings/% no bucket proposta-uploads. Substitui portal_uploads_insert_anon (overly permissive). Migration 20260527.';

COMMIT;
