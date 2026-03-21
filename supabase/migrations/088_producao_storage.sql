-- ============================================================================
-- 088 — Bucket de arquivos de produção para o chão de fábrica
-- ============================================================================

-- Criar bucket producao-arquivos (privado, acesso via signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('producao-arquivos', 'producao-arquivos', false)
ON CONFLICT DO NOTHING;

-- RLS: apenas usuários autenticados podem ler/escrever
CREATE POLICY IF NOT EXISTS "producao_arquivos_auth_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'producao-arquivos');

CREATE POLICY IF NOT EXISTS "producao_arquivos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'producao-arquivos');

CREATE POLICY IF NOT EXISTS "producao_arquivos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'producao-arquivos');
