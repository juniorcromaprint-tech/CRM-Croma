-- ============================================================================
-- 016_modelo_materiais_tipo.sql
-- Adiciona coluna tipo em modelo_materiais para distinguir:
--   'material'   = material base / substrato (ex: frontlight, lona)
--   'acabamento' = material de acabamento    (ex: bastão de madeira, ponteira, cordinha)
-- ============================================================================

ALTER TABLE modelo_materiais
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'material';

COMMENT ON COLUMN modelo_materiais.tipo IS
  'Classificação do material: material (base/substrato) ou acabamento (finalização)';

-- Índice para facilitar filtragem por tipo
CREATE INDEX IF NOT EXISTS idx_modelo_mat_tipo ON modelo_materiais(tipo);
