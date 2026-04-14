-- Hardening: auditoria, dedup, soft-delete, integridade
-- Migration 124 — 2026-04-14

-- Audit trail por usuário
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Dedup por hash
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS file_sha256 text;

-- Soft delete
ALTER TABLE proposta_attachments
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Integridade: 1 fileId OneDrive = 1 linha (evita race em retry)
CREATE UNIQUE INDEX IF NOT EXISTS proposta_attachments_onedrive_file_id_uniq
  ON proposta_attachments(onedrive_file_id)
  WHERE onedrive_file_id IS NOT NULL AND deleted_at IS NULL;

-- Dedup: mesma proposta nao aceita 2 arquivos com mesmo hash
CREATE UNIQUE INDEX IF NOT EXISTS proposta_attachments_dedup_sha
  ON proposta_attachments(proposta_id, file_sha256)
  WHERE file_sha256 IS NOT NULL AND deleted_at IS NULL;

-- Query de listagem otimizada
CREATE INDEX IF NOT EXISTS proposta_attachments_proposta_active_idx
  ON proposta_attachments(proposta_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN proposta_attachments.uploaded_by_user_id IS
  'FK pra profiles.id. NULL = anexo do cliente via portal (sem login). Usado pra auditoria e policy de delete.';
COMMENT ON COLUMN proposta_attachments.file_sha256 IS
  'Hash SHA-256 do arquivo calculado no client antes do upload. Usado pra dedup.';
COMMENT ON COLUMN proposta_attachments.deleted_at IS
  'Soft delete. Cron job de 30d faz hard delete + limpeza OneDrive.';
