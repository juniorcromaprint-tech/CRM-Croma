-- =============================================================================
-- MIGRATION 005 — STORAGE SECURITY: bucket job_photos + job_videos
-- Projeto: djwjmfgplnqyffdcgdaw
-- Data: 2026-03-10
-- Autores: Equipe Croma Print
-- =============================================================================
-- CONTEXTO:
--   O bucket job_photos estava configurado como público (public = true) com
--   políticas FOR ALL USING (true), permitindo leitura, escrita e exclusão
--   por qualquer pessoa sem autenticação. Este migration:
--     1. Torna os buckets job_photos e job_videos privados
--     2. Remove todas as políticas públicas/permissivas existentes
--     3. Implementa RLS granular por role (admin | instalador) e ownership
--     4. Cria/atualiza helper functions para uso nas políticas
--     5. Fortalece RLS nas tabelas relacionais job_photos e job_videos
--     6. Corrige RLS em campo_audit_logs e company_settings
--
-- DEPENDÊNCIAS:
--   - Migration 003_campo_migration.sql (tabelas jobs, job_photos, job_videos,
--     profiles, company_settings, campo_audit_logs)
--   - profiles.role IN ('admin', 'instalador')
--   - jobs.assigned_to UUID REFERENCES profiles.id
--   - jobs.status TEXT (inclui valor 'Concluído')
--   - jobs.deleted_at TIMESTAMPTZ (soft delete)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS (SECURITY DEFINER — executam como owner da função)
-- -----------------------------------------------------------------------------

-- Retorna o role do usuário autenticado.
-- Já pode existir no schema principal (001/002); CREATE OR REPLACE é idempotente.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica acesso genérico a um job: admin tem acesso total,
-- instalador apenas a jobs atribuídos a ele (não deletados).
CREATE OR REPLACE FUNCTION user_has_job_access(p_job_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = p_job_id
    AND (
      get_user_role() = 'admin'
      OR j.assigned_to = auth.uid()
    )
    AND j.deleted_at IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o instalador pode fazer upload em um job:
-- deve estar atribuído a ele E o job não pode estar Concluído.
CREATE OR REPLACE FUNCTION instalador_can_upload(p_job_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = p_job_id
    AND j.assigned_to = auth.uid()
    AND j.status != 'Concluído'
    AND j.deleted_at IS NULL
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- -----------------------------------------------------------------------------
-- 1. TORNAR OS BUCKETS PRIVADOS
-- -----------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id IN ('job_photos', 'job_videos');

-- Garantir existência e privacidade (idempotente)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('job_photos', 'job_photos', false),
  ('job_videos', 'job_videos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- -----------------------------------------------------------------------------
-- 2. REMOÇÃO DAS POLÍTICAS PÚBLICAS/PERMISSIVAS EXISTENTES
-- -----------------------------------------------------------------------------

-- Da versão supabase_storage_setup.sql (políticas totalmente públicas)
DROP POLICY IF EXISTS "public_read"                          ON storage.objects;
DROP POLICY IF EXISTS "public_insert"                        ON storage.objects;
DROP POLICY IF EXISTS "public_update"                        ON storage.objects;
DROP POLICY IF EXISTS "public_delete"                        ON storage.objects;

-- Da migration 003_campo_migration.sql
DROP POLICY IF EXISTS "public_read_photos"                   ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_photos"          ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_photos"          ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_photos"          ON storage.objects;

-- Políticas genéricas do Supabase dashboard / templates comuns
DROP POLICY IF EXISTS "Public Access"                        ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload"                    ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own images"   ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder"      ON storage.objects;
DROP POLICY IF EXISTS "Allow public read"                    ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads"          ON storage.objects;
DROP POLICY IF EXISTS "Acesso publico para leitura de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de fotos"             ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de fotos"        ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de fotos"           ON storage.objects;

-- Vídeos — limpeza preventiva
DROP POLICY IF EXISTS "public_read_videos"                   ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_videos"          ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_videos"          ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_videos"          ON storage.objects;

-- Políticas novas (para idempotência em reaplicação)
DROP POLICY IF EXISTS "job_photos_select_admin"              ON storage.objects;
DROP POLICY IF EXISTS "job_photos_select_instalador"         ON storage.objects;
DROP POLICY IF EXISTS "job_photos_insert_admin"              ON storage.objects;
DROP POLICY IF EXISTS "job_photos_insert_instalador"         ON storage.objects;
DROP POLICY IF EXISTS "job_photos_update_admin"              ON storage.objects;
DROP POLICY IF EXISTS "job_photos_update_instalador"         ON storage.objects;
DROP POLICY IF EXISTS "job_photos_delete_admin"              ON storage.objects;
DROP POLICY IF EXISTS "job_videos_select_authenticated"      ON storage.objects;
DROP POLICY IF EXISTS "job_videos_insert_admin"              ON storage.objects;
DROP POLICY IF EXISTS "job_videos_insert_instalador"         ON storage.objects;
DROP POLICY IF EXISTS "job_videos_delete_admin"              ON storage.objects;

-- -----------------------------------------------------------------------------
-- 3. NOVAS POLÍTICAS RLS — STORAGE bucket job_photos
-- -----------------------------------------------------------------------------
--
-- NOTA SOBRE EXTRAÇÃO DE job_id:
--   Padrões de filename usados pelo App de Campo:
--     img_{job_id}_{type}_{ts}_{i}.ext  → job_id em posição [5..40]
--     {job_id}-{type}-{random}.ext      → job_id em posição [1..36]
--     sig_{job_id}_{ts}.png             → job_id em posição [5..40]
--   Para SELECT/UPDATE: verificação via tabela job_photos (photo_url LIKE '%'||name)
--   Para INSERT: extração via SUBSTRING + regex match

-- 3.1 SELECT — Admin: acesso a todas as fotos
CREATE POLICY "job_photos_select_admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.2 SELECT — Instalador: apenas fotos de seus jobs
CREATE POLICY "job_photos_select_instalador"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'instalador'
  AND EXISTS (
    SELECT 1
    FROM job_photos jp
    JOIN jobs j ON j.id = jp.job_id
    WHERE jp.photo_url LIKE '%' || storage.objects.name
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
);

-- 3.3 INSERT — Admin: qualquer job
CREATE POLICY "job_photos_insert_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.4 INSERT — Instalador: jobs atribuídos a ele, não Concluídos
--   Extrai job_id do filename via regex por padrão
CREATE POLICY "job_photos_insert_instalador"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_photos'
  AND get_user_role() = 'instalador'
  AND (
    -- Padrão img_{job_id}_...
    (
      storage.objects.name ~ '^img_[0-9a-f-]{36}_'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 5 FOR 36)::UUID
      )
    )
    OR
    -- Padrão {job_id}-... (UUID legado no início)
    (
      storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 1 FOR 36)::UUID
      )
    )
    OR
    -- Padrão sig_{job_id}_... (assinaturas)
    (
      storage.objects.name ~ '^sig_[0-9a-f-]{36}_'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 5 FOR 36)::UUID
      )
    )
  )
);

-- 3.5 UPDATE — Admin: qualquer foto
CREATE POLICY "job_photos_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.6 UPDATE — Instalador: apenas fotos de seus jobs
CREATE POLICY "job_photos_update_instalador"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'instalador'
  AND EXISTS (
    SELECT 1
    FROM job_photos jp
    JOIN jobs j ON j.id = jp.job_id
    WHERE jp.photo_url LIKE '%' || storage.objects.name
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
);

-- 3.7 DELETE — Apenas admin
CREATE POLICY "job_photos_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- -----------------------------------------------------------------------------
-- 4. NOVAS POLÍTICAS RLS — STORAGE bucket job_videos
-- -----------------------------------------------------------------------------

-- 4.1 SELECT — Admin e instalador (apenas seus jobs)
CREATE POLICY "job_videos_select_authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_videos'
  AND (
    get_user_role() = 'admin'
    OR (
      get_user_role() = 'instalador'
      AND EXISTS (
        SELECT 1
        FROM job_videos jv
        JOIN jobs j ON j.id = jv.job_id
        WHERE jv.video_url LIKE '%' || storage.objects.name
        AND j.assigned_to = auth.uid()
        AND j.deleted_at IS NULL
      )
    )
  )
);

-- 4.2 INSERT — Admin: qualquer job
CREATE POLICY "job_videos_insert_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_videos'
  AND get_user_role() = 'admin'
);

-- 4.3 INSERT — Instalador: jobs atribuídos (padrão vid_{job_id}_{ts}.ext)
CREATE POLICY "job_videos_insert_instalador"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_videos'
  AND get_user_role() = 'instalador'
  AND storage.objects.name ~ '^vid_[0-9a-f-]{36}_'
  AND instalador_can_upload(
    SUBSTRING(storage.objects.name FROM 5 FOR 36)::UUID
  )
);

-- 4.4 DELETE — Apenas admin
CREATE POLICY "job_videos_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job_videos'
  AND get_user_role() = 'admin'
);

-- -----------------------------------------------------------------------------
-- 5. RLS — TABELA job_photos (banco relacional)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS job_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_photos"   ON job_photos;
DROP POLICY IF EXISTS "authenticated_insert_photos" ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_select"     ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_insert"     ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_update"     ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_delete"     ON job_photos;

-- SELECT: admin vê tudo; instalador vê apenas seus jobs
CREATE POLICY "job_photos_table_select"
ON job_photos
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_photos.job_id
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
);

-- INSERT: admin ou instalador em jobs atribuídos não Concluídos
CREATE POLICY "job_photos_table_insert"
ON job_photos
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin'
  OR instalador_can_upload(job_id)
);

-- UPDATE: admin ou instalador em seus jobs
CREATE POLICY "job_photos_table_update"
ON job_photos
FOR UPDATE
TO authenticated
USING (
  get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_photos.job_id
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
)
WITH CHECK (
  get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_photos.job_id
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
);

-- DELETE: apenas admin
CREATE POLICY "job_photos_table_delete"
ON job_photos
FOR DELETE
TO authenticated
USING (get_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 6. RLS — TABELA job_videos (banco relacional)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS job_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_videos"   ON job_videos;
DROP POLICY IF EXISTS "authenticated_insert_videos" ON job_videos;
DROP POLICY IF EXISTS "job_videos_table_select"     ON job_videos;
DROP POLICY IF EXISTS "job_videos_table_insert"     ON job_videos;
DROP POLICY IF EXISTS "job_videos_table_delete"     ON job_videos;

-- SELECT: admin vê tudo; instalador vê apenas seus jobs
CREATE POLICY "job_videos_table_select"
ON job_videos
FOR SELECT
TO authenticated
USING (
  get_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = job_videos.job_id
    AND j.assigned_to = auth.uid()
    AND j.deleted_at IS NULL
  )
);

-- INSERT: admin ou instalador em jobs atribuídos não Concluídos
CREATE POLICY "job_videos_table_insert"
ON job_videos
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin'
  OR instalador_can_upload(job_id)
);

-- DELETE: apenas admin
CREATE POLICY "job_videos_table_delete"
ON job_videos
FOR DELETE
TO authenticated
USING (get_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 7. RLS — TABELA company_settings
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_settings" ON company_settings;
DROP POLICY IF EXISTS "admin_all_settings"          ON company_settings;

-- SELECT: todos autenticados (necessário para carregar logo/nome no app)
CREATE POLICY "authenticated_read_settings"
ON company_settings
FOR SELECT
TO authenticated
USING (true);

-- ALL (INSERT/UPDATE/DELETE): apenas admin
CREATE POLICY "admin_all_settings"
ON company_settings
FOR ALL
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 8. RLS — TABELA campo_audit_logs (logs imutáveis)
-- -----------------------------------------------------------------------------

ALTER TABLE IF EXISTS campo_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_audit_logs"  ON campo_audit_logs;
DROP POLICY IF EXISTS "self_insert_audit_logs" ON campo_audit_logs;
DROP POLICY IF EXISTS "admin_all_audit_logs"   ON campo_audit_logs;

-- SELECT: apenas admin consulta os logs
CREATE POLICY "admin_read_audit_logs"
ON campo_audit_logs
FOR SELECT
TO authenticated
USING (get_user_role() = 'admin');

-- INSERT: qualquer autenticado pode inserir seu próprio log (app registra ações)
CREATE POLICY "self_insert_audit_logs"
ON campo_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE e DELETE: nenhuma policy → ninguém pode alterar/excluir logs

-- =============================================================================
-- VERIFICAÇÃO PÓS-APLICAÇÃO
-- Execute estas queries no SQL Editor do Supabase para validar:
-- =============================================================================
--
-- 1. Confirmar buckets privados:
--    SELECT id, name, public
--    FROM storage.buckets
--    WHERE id IN ('job_photos', 'job_videos');
--    → Esperado: public = false para ambos
--
-- 2. Listar policies do storage:
--    SELECT policyname, cmd, qual
--    FROM pg_policies
--    WHERE tablename = 'objects' AND schemaname = 'storage'
--    AND policyname LIKE 'job_%'
--    ORDER BY policyname;
--    → Esperado: 11 policies (7 job_photos + 4 job_videos)
--
-- 3. Listar policies das tabelas relacionais:
--    SELECT tablename, policyname, cmd
--    FROM pg_policies
--    WHERE tablename IN (
--      'job_photos','job_videos','company_settings','campo_audit_logs'
--    )
--    ORDER BY tablename, policyname;
--
-- 4. Testar acesso como instalador (substitua UUIDs):
--    -- Simular contexto do instalador
--    SET LOCAL role TO authenticated;
--    SELECT set_config('request.jwt.claims',
--      '{"sub":"<installer_uuid>","role":"authenticated"}', true);
--    -- Deve retornar apenas fotos dos seus jobs
--    SELECT COUNT(*) FROM job_photos;
--    -- Deve retornar false para jobs de outros instaladores
--    SELECT user_has_job_access('<outro_job_uuid>');
--
-- 5. Testar função helper:
--    SELECT user_has_job_access('<job_uuid_do_instalador>');
--    → TRUE se autenticado como admin ou como o instalador atribuído
--    SELECT instalador_can_upload('<job_uuid_nao_concluido>');
--    → TRUE apenas se assigned_to = auth.uid() AND status != 'Concluído'
--
-- 6. Confirmar ausência de policies públicas:
--    SELECT COUNT(*) FROM pg_policies
--    WHERE tablename = 'objects' AND schemaname = 'storage'
--    AND (qual = 'true' OR with_check = 'true');
--    → Esperado: 0
-- =============================================================================
