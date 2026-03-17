-- 043_regras_10_componentes.sql
-- Adicionar overrides dos 10 componentes de precificação por categoria em regras_precificacao

ALTER TABLE regras_precificacao
  ADD COLUMN IF NOT EXISTS pct_cf_override    NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS pct_mo_override    NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS pct_tf_override    NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS custo_ci_m2        NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS custo_ce_hora      NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS pct_tb             NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS pct_tr             NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS pct_dt             NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS margem_minima_pct  NUMERIC(6,2);

COMMENT ON COLUMN regras_precificacao.pct_cf_override IS 'Override do % de custos fixos para esta categoria (NULL = usa global)';
COMMENT ON COLUMN regras_precificacao.pct_tr IS 'Taxa de retrabalho/buffer de qualidade (ex: 3 = 3%)';
COMMENT ON COLUMN regras_precificacao.margem_minima_pct IS 'Margem líquida mínima aceitável para esta categoria';
