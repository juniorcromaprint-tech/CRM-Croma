-- =============================================================================
-- MIGRATION 033 — STORAGE: bucket proposta-uploads (portal do cliente)
-- Projeto: djwjmfgplnqyffdcgdaw
-- Data: 2026-03-15
-- =============================================================================
-- Cria o bucket para uploads de arquivos pelo cliente no portal público.
-- O portal usa anon key (usuário não autenticado), por isso as políticas
-- permitem INSERT/SELECT para o role 'anon' sem exigir autenticação.
-- Os arquivos ficam em: portal-uploads/{token}/{timestamp}-{nome_arquivo}
-- =============================================================================

-- 1. Criar bucket privado (não público, acesso via signed URLs ou service role)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'proposta-uploads',
  'proposta-uploads',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/x-tiff',
    'application/postscript',          -- AI, EPS
    'application/eps',
    'application/x-eps',
    'image/eps',
    'application/x-coreldraw',         -- CDR
    'image/vnd.adobe.photoshop',       -- PSD
    'application/octet-stream'         -- fallback para extensões não reconhecidas
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Limpar políticas antigas se existirem (idempotência)
DROP POLICY IF EXISTS "portal_uploads_insert_anon"  ON storage.objects;
DROP POLICY IF EXISTS "portal_uploads_select_anon"  ON storage.objects;
DROP POLICY IF EXISTS "portal_uploads_select_auth"  ON storage.objects;
DROP POLICY IF EXISTS "portal_uploads_delete_auth"  ON storage.objects;

-- 3. INSERT — anon pode fazer upload (cliente no portal sem login)
CREATE POLICY "portal_uploads_insert_anon"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'proposta-uploads');

-- 4. SELECT — anon pode ler seus próprios uploads (preview no portal)
CREATE POLICY "portal_uploads_select_anon"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'proposta-uploads');

-- 5. SELECT — autenticados (equipe interna) podem ler todos os uploads
CREATE POLICY "portal_uploads_select_auth"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'proposta-uploads');

-- 6. DELETE — apenas autenticados podem deletar (limpeza pela equipe)
CREATE POLICY "portal_uploads_delete_auth"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'proposta-uploads');
