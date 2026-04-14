-- Migration 123: Adiciona tracking do arquivo OneDrive na arte do item
-- Necessario pra deletar arquivo antigo ao substituir a arte
-- 2026-04-14
ALTER TABLE pedido_itens ADD COLUMN IF NOT EXISTS arte_onedrive_file_id text;

COMMENT ON COLUMN pedido_itens.arte_onedrive_file_id IS
  'DriveItem ID no OneDrive via Microsoft Graph. Usado pra deletar arquivo antigo ao substituir a arte. NULL = arte legada no Supabase Storage (pre-v14) ou ainda nao enviada.';
