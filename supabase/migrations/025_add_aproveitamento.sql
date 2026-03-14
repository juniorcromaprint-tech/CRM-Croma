ALTER TABLE materiais
ADD COLUMN IF NOT EXISTS aproveitamento numeric(5,2) DEFAULT 100
CHECK (aproveitamento > 0 AND aproveitamento <= 100);

COMMENT ON COLUMN materiais.aproveitamento IS 'Percentual de aproveitamento do material (ex: 85 = 15% desperdício). Default 100 = sem perda.';
