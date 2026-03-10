-- =============================================================================
-- STORAGE SECURITY — bucket job_photos (e job_videos)
-- Substitui: supabase_storage_setup.sql (políticas públicas)
-- Projeto: djwjmfgplnqyffdcgdaw
-- Data: 2026-03-10
-- =============================================================================
-- OBJETIVO: Revogar acesso público e implementar RLS por role e ownership.
--
-- MATRIZ DE PERMISSÕES:
--   Storage SELECT  │ admin: todos os jobs │ instalador: apenas seus jobs
--   Storage INSERT  │ admin: qualquer job  │ instalador: job assigned_to=uid + status != 'Concluído'
--   Storage UPDATE  │ admin: qualquer foto │ instalador: fotos que ele mesmo fez upload
--   Storage DELETE  │ apenas admin
--
--   job_videos SELECT │ admin + instalador autenticado (mesmo job)
--   job_videos INSERT │ admin + instalador (job assigned_to=uid)
--   job_videos DELETE │ apenas admin
--
-- PADRÕES DE FILENAME NO BUCKET job_photos (todos sem subpasta):
--   img_{job_id}_{type}_{timestamp}_{i}.ext   — app atual
--   {job_id}-{type}-{random}.ext              — legado
--   sig_{job_id}_{timestamp}.png              — assinaturas
--
-- ESTRATÉGIA: como o job_id está no nome do arquivo mas sem estrutura de pasta
-- consistente, a verificação de ownership usa a tabela job_photos/job_videos
-- como fonte de verdade via EXISTS subquery sobre photo_url (para SELECT/UPDATE)
-- e a tabela jobs (para INSERT). Admin tem acesso irrestrito ao bucket.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Retorna o role do usuário autenticado (já pode existir no schema principal)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Verifica se o usuário autenticado tem acesso a um job específico.
-- Admin: acesso total. Instalador: apenas jobs atribuídos a ele.
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

-- Verifica se o instalador pode fazer upload em um job
-- (atribuído a ele E job não está Concluído)
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
-- 1. TORNAR O BUCKET PRIVADO
-- -----------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false
WHERE id = 'job_photos';

-- Garantir que o bucket existe (idempotente) e já nasce privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_photos', 'job_photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- -----------------------------------------------------------------------------
-- 2. REMOVER TODAS AS POLÍTICAS PÚBLICAS EXISTENTES DO BUCKET job_photos
-- -----------------------------------------------------------------------------

-- Políticas do arquivo supabase_storage_setup.sql (versão pública)
DROP POLICY IF EXISTS "public_read"                         ON storage.objects;
DROP POLICY IF EXISTS "public_insert"                       ON storage.objects;
DROP POLICY IF EXISTS "public_update"                       ON storage.objects;
DROP POLICY IF EXISTS "public_delete"                       ON storage.objects;

-- Políticas do migration 003_campo_migration.sql
DROP POLICY IF EXISTS "public_read_photos"                  ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_photos"         ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_photos"         ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_photos"         ON storage.objects;

-- Políticas genéricas comuns
DROP POLICY IF EXISTS "Public Access"                       ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload"                   ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update their own images"  ON storage.objects;
DROP POLICY IF EXISTS "Give users access to own folder"     ON storage.objects;
DROP POLICY IF EXISTS "Allow public read"                   ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads"         ON storage.objects;
DROP POLICY IF EXISTS "Acesso publico para leitura de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de fotos"            ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de fotos"       ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de fotos"          ON storage.objects;

-- Políticas de vídeo genéricas (limpeza preventiva)
DROP POLICY IF EXISTS "public_read_videos"                  ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_videos"         ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_videos"         ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_videos"         ON storage.objects;

-- Políticas novas (caso migration seja reaplicado — idempotência)
DROP POLICY IF EXISTS "job_photos_select_admin"             ON storage.objects;
DROP POLICY IF EXISTS "job_photos_select_instalador"        ON storage.objects;
DROP POLICY IF EXISTS "job_photos_insert_admin"             ON storage.objects;
DROP POLICY IF EXISTS "job_photos_insert_instalador"        ON storage.objects;
DROP POLICY IF EXISTS "job_photos_update_admin"             ON storage.objects;
DROP POLICY IF EXISTS "job_photos_update_instalador"        ON storage.objects;
DROP POLICY IF EXISTS "job_photos_delete_admin"             ON storage.objects;
DROP POLICY IF EXISTS "job_videos_select_authenticated"     ON storage.objects;
DROP POLICY IF EXISTS "job_videos_insert_admin"             ON storage.objects;
DROP POLICY IF EXISTS "job_videos_insert_instalador"        ON storage.objects;
DROP POLICY IF EXISTS "job_videos_delete_admin"             ON storage.objects;

-- -----------------------------------------------------------------------------
-- 3. NOVAS POLÍTICAS RLS — bucket job_photos
-- -----------------------------------------------------------------------------
-- Contexto: storage.objects.name contém apenas o filename (sem prefixo de bucket).
-- A relação entre arquivo e job é verificada via tabela job_photos (photo_url
-- contém a URL completa) ou via jobs (para INSERT, usando o job_id recebido
-- no nome do arquivo). Para INSERT usamos a função instalador_can_upload().
-- Admin tem permissão irrestrita em todas as operações.

-- 3.1 SELECT — Admin vê todas as fotos do bucket
CREATE POLICY "job_photos_select_admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.2 SELECT — Instalador vê apenas fotos de jobs atribuídos a ele
--   Verifica via tabela job_photos: a photo_url do registro termina com o
--   filename armazenado em storage.objects.name
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

-- 3.3 INSERT — Admin pode fazer upload em qualquer job
CREATE POLICY "job_photos_insert_admin"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.4 INSERT — Instalador pode fazer upload somente em jobs atribuídos a ele
--   e que ainda não estão Concluídos. O job_id é extraído do nome do arquivo
--   usando os padrões conhecidos:
--     img_{job_id}_...  →  split por '_', posição 1 (0-indexed)
--     {job_id}-...      →  split por '-', posições 0-4 (UUID)
--   Como os padrões são múltiplos, usamos substring regex para extrair UUID.
CREATE POLICY "job_photos_insert_instalador"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job_photos'
  AND get_user_role() = 'instalador'
  AND (
    -- Padrão img_{job_id}_{type}_{ts}_{i}.ext
    (
      storage.objects.name ~ '^img_[0-9a-f-]{36}_'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 5 FOR 36)::UUID
      )
    )
    OR
    -- Padrão {job_id}-{type}-{random}.ext (UUID no início)
    (
      storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 1 FOR 36)::UUID
      )
    )
    OR
    -- Padrão sig_{job_id}_{ts}.png (assinaturas — job_id após 'sig_')
    (
      storage.objects.name ~ '^sig_[0-9a-f-]{36}_'
      AND instalador_can_upload(
        SUBSTRING(storage.objects.name FROM 5 FOR 36)::UUID
      )
    )
  )
);

-- 3.5 UPDATE — Admin pode editar qualquer foto
CREATE POLICY "job_photos_update_admin"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- 3.6 UPDATE — Instalador pode editar apenas fotos que ele mesmo fez upload
--   (verifica via job_photos: photo_url corresponde ao arquivo + job assigned_to = uid)
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

-- 3.7 DELETE — Apenas admin pode excluir fotos
CREATE POLICY "job_photos_delete_admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'job_photos'
  AND get_user_role() = 'admin'
);

-- -----------------------------------------------------------------------------
-- 4. BUCKET job_videos — mesmo padrão de segurança
-- -----------------------------------------------------------------------------

-- Garantir bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_videos', 'job_videos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 4.1 SELECT — Admin e instalador autenticado (apenas seus jobs)
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

-- 4.3 INSERT — Instalador: job atribuído a ele e não Concluído
--   Padrão de filename de vídeo: vid_{job_id}_{ts}.ext
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
-- 5. RLS — TABELAS DE SUPORTE: campo_audit_logs e company_settings
-- -----------------------------------------------------------------------------

-- Garantir RLS ativo (pode já estar, idempotente)
ALTER TABLE IF EXISTS campo_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS company_settings  ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas para reaplicação limpa
DROP POLICY IF EXISTS "authenticated_read_settings"  ON company_settings;
DROP POLICY IF EXISTS "admin_all_settings"           ON company_settings;
DROP POLICY IF EXISTS "admin_read_audit_logs"        ON campo_audit_logs;
DROP POLICY IF EXISTS "self_insert_audit_logs"       ON campo_audit_logs;
DROP POLICY IF EXISTS "admin_all_audit_logs"         ON campo_audit_logs;

-- 5.1 company_settings
--   SELECT: todos os usuários autenticados (necessário para o app carregar logo/nome)
--   INSERT/UPDATE/DELETE: apenas admin
CREATE POLICY "authenticated_read_settings"
ON company_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "admin_all_settings"
ON company_settings
FOR ALL
TO authenticated
USING (get_user_role() = 'admin')
WITH CHECK (get_user_role() = 'admin');

-- 5.2 campo_audit_logs
--   SELECT: apenas admin pode ver todos os registros de auditoria
--   INSERT: qualquer usuário autenticado pode inserir seu próprio log
--   UPDATE/DELETE: ninguém (logs são imutáveis)
CREATE POLICY "admin_read_audit_logs"
ON campo_audit_logs
FOR SELECT
TO authenticated
USING (get_user_role() = 'admin');

CREATE POLICY "self_insert_audit_logs"
ON campo_audit_logs
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 6. RLS — TABELAS job_photos e job_videos (banco relacional)
-- -----------------------------------------------------------------------------
-- Substituir políticas permissivas por políticas granulares por role/ownership.

ALTER TABLE IF EXISTS job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS job_videos ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas permissivas
DROP POLICY IF EXISTS "authenticated_read_photos"  ON job_photos;
DROP POLICY IF EXISTS "authenticated_insert_photos" ON job_photos;
DROP POLICY IF EXISTS "authenticated_read_videos"  ON job_videos;
DROP POLICY IF EXISTS "authenticated_insert_videos" ON job_videos;

-- Novas políticas (idempotência)
DROP POLICY IF EXISTS "job_photos_table_select"    ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_insert"    ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_update"    ON job_photos;
DROP POLICY IF EXISTS "job_photos_table_delete"    ON job_photos;
DROP POLICY IF EXISTS "job_videos_table_select"    ON job_videos;
DROP POLICY IF EXISTS "job_videos_table_insert"    ON job_videos;
DROP POLICY IF EXISTS "job_videos_table_delete"    ON job_videos;

-- job_photos: SELECT
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

-- job_photos: INSERT (instalador em jobs atribuídos a ele não Concluídos)
CREATE POLICY "job_photos_table_insert"
ON job_photos
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin'
  OR instalador_can_upload(job_id)
);

-- job_photos: UPDATE (admin: qualquer; instalador: apenas seus jobs)
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

-- job_photos: DELETE (apenas admin)
CREATE POLICY "job_photos_table_delete"
ON job_photos
FOR DELETE
TO authenticated
USING (get_user_role() = 'admin');

-- job_videos: SELECT
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

-- job_videos: INSERT
CREATE POLICY "job_videos_table_insert"
ON job_videos
FOR INSERT
TO authenticated
WITH CHECK (
  get_user_role() = 'admin'
  OR instalador_can_upload(job_id)
);

-- job_videos: DELETE (apenas admin)
CREATE POLICY "job_videos_table_delete"
ON job_videos
FOR DELETE
TO authenticated
USING (get_user_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 7. VERIFICAÇÃO — queries para confirmar as políticas aplicadas
-- -----------------------------------------------------------------------------
-- Execute no SQL Editor do Supabase para validar:
--
-- 7.1 Confirmar bucket privado:
--   SELECT id, name, public FROM storage.buckets WHERE id IN ('job_photos','job_videos');
--   → public deve ser FALSE para ambos
--
-- 7.2 Listar todas as políticas do bucket:
--   SELECT policyname, cmd, qual, with_check
--   FROM pg_policies
--   WHERE tablename = 'objects' AND schemaname = 'storage'
--   ORDER BY policyname;
--
-- 7.3 Simular acesso como instalador (substitua o UUID):
--   SET LOCAL role authenticated;
--   SELECT set_config('request.jwt.claims', '{"sub":"<installer_uuid>","role":"authenticated"}', true);
--   SELECT COUNT(*) FROM storage.objects WHERE bucket_id = 'job_photos';
--   → Deve retornar apenas arquivos de jobs assigned_to = <installer_uuid>
--
-- 7.4 Confirmar políticas de tabelas relacionais:
--   SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE tablename IN ('job_photos','job_videos','company_settings','campo_audit_logs')
--   ORDER BY tablename, policyname;
--
-- 7.5 Testar função de acesso:
--   SELECT user_has_job_access('<job_uuid>');
--   → TRUE para admin, TRUE para instalador do job, FALSE para outros
-- =============================================================================
