-- 042_bom_columns.sql
-- Adicionar colunas BOM em modelo_materiais e modelo_processos

ALTER TABLE modelo_materiais
  ADD COLUMN IF NOT EXISTS percentual_desperdicio NUMERIC(5,2) DEFAULT 0 CHECK (percentual_desperdicio >= 0 AND percentual_desperdicio <= 100),
  ADD COLUMN IF NOT EXISTS custo_unitario         NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS unidade_medida         TEXT;

COMMENT ON COLUMN modelo_materiais.percentual_desperdicio IS 'Percentual de desperdício no corte/uso (0-100)';
COMMENT ON COLUMN modelo_materiais.custo_unitario IS 'Override de custo unitário; se NULL usa materiais.preco_unitario';
COMMENT ON COLUMN modelo_materiais.unidade_medida IS 'Override de unidade; se NULL usa materiais.unidade_medida';

ALTER TABLE modelo_processos
  ADD COLUMN IF NOT EXISTS custo_unitario      NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS tempo_setup_min     NUMERIC(8,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidade_medida      TEXT;

COMMENT ON COLUMN modelo_processos.custo_unitario IS 'Custo por minuto do processo; se NULL usa custo por minuto global';
COMMENT ON COLUMN modelo_processos.tempo_setup_min IS 'Tempo de setup em minutos (diluído pela quantidade)';

CREATE INDEX IF NOT EXISTS idx_modelo_materiais_modelo ON modelo_materiais(modelo_id);
CREATE INDEX IF NOT EXISTS idx_modelo_processos_modelo ON modelo_processos(modelo_id);
