-- ============================================================================
-- Migration 122: Adiciona preview_url em proposta_attachments
-- ============================================================================
-- Quando cliente sobe arte pelo portal, o frontend gera um preview JPG leve
-- via gerarPreviewArte() (src/lib/arte-preview.ts) e sobe no bucket publico
-- `job-attachments/proposta-previews/`. A URL publica desse preview eh salva
-- aqui para exibir thumbnail na UI (portal, ERP, App Campo) sem precisar
-- baixar o original gigante do OneDrive.
--
-- Coluna eh nullable: nem todos os tipos aceitos pelo portal (AI, CDR, EPS,
-- PSD, TIFF) sao "previewable" no browser. Nesses casos preview_url fica NULL
-- e a UI mostra um icone generico.
-- ============================================================================

BEGIN;

ALTER TABLE public.proposta_attachments
  ADD COLUMN IF NOT EXISTS preview_url TEXT NULL;

COMMENT ON COLUMN public.proposta_attachments.preview_url IS
  'URL publica do preview JPG leve (max 1600px). Gerado no browser via gerarPreviewArte e salvo no bucket job-attachments/proposta-previews/. NULL quando o formato nao eh previewable (AI, CDR, EPS, PSD, TIFF).';

COMMIT;
