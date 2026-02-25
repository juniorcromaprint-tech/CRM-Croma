-- 1. Criar o bucket (pasta) 'job_photos' se ele não existir e garantir que seja público
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_photos', 'job_photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Permitir acesso público para leitura das imagens (SELECT)
DROP POLICY IF EXISTS "Acesso publico para leitura de fotos" ON storage.objects;
CREATE POLICY "Acesso publico para leitura de fotos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'job_photos');

-- 3. Permitir que usuários autenticados façam upload de imagens (INSERT)
DROP POLICY IF EXISTS "Permitir upload de fotos" ON storage.objects;
CREATE POLICY "Permitir upload de fotos" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'job_photos');

-- 4. Permitir que usuários autenticados atualizem imagens (UPDATE)
DROP POLICY IF EXISTS "Permitir atualizacao de fotos" ON storage.objects;
CREATE POLICY "Permitir atualizacao de fotos" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (bucket_id = 'job_photos');

-- 5. Permitir que usuários autenticados deletem imagens (DELETE)
DROP POLICY IF EXISTS "Permitir exclusao de fotos" ON storage.objects;
CREATE POLICY "Permitir exclusao de fotos" 
ON storage.objects FOR DELETE 
TO authenticated
USING (bucket_id = 'job_photos');