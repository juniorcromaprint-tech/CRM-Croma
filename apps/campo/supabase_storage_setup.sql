-- 1. Criar o bucket (pasta) 'job_photos' se ele não existir e garantir que seja público
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_photos', 'job_photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Remover TODAS as politicas antigas para evitar conflitos
DROP POLICY IF EXISTS "Acesso publico para leitura de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao de fotos" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao de fotos" ON storage.objects;
DROP POLICY IF EXISTS "public_read" ON storage.objects;
DROP POLICY IF EXISTS "public_insert" ON storage.objects;
DROP POLICY IF EXISTS "public_update" ON storage.objects;
DROP POLICY IF EXISTS "public_delete" ON storage.objects;

-- 3. Criar politicas TOTALMENTE PUBLICAS para o bucket job_photos (para evitar qualquer erro de RLS)
CREATE POLICY "public_read" ON storage.objects FOR SELECT USING (bucket_id = 'job_photos');
CREATE POLICY "public_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'job_photos');
CREATE POLICY "public_update" ON storage.objects FOR UPDATE USING (bucket_id = 'job_photos');
CREATE POLICY "public_delete" ON storage.objects FOR DELETE USING (bucket_id = 'job_photos');