-- Adiciona coluna de anotação nas fotos de instalação
-- Execute este script no Supabase Dashboard > SQL Editor
ALTER TABLE job_photos ADD COLUMN IF NOT EXISTS note TEXT;
