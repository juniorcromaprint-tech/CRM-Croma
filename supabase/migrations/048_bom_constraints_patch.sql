-- 048_bom_constraints_patch.sql
-- CHECK constraints para integridade dos dados BOM e regras de precificação

DO $$
BEGIN
  -- modelo_materiais
  BEGIN
    ALTER TABLE modelo_materiais ADD CONSTRAINT chk_mm_custo_unitario_positive CHECK (custo_unitario IS NULL OR custo_unitario >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- modelo_processos
  BEGIN
    ALTER TABLE modelo_processos ADD CONSTRAINT chk_mp_custo_unitario_positive CHECK (custo_unitario IS NULL OR custo_unitario >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE modelo_processos ADD CONSTRAINT chk_mp_tempo_setup_positive CHECK (tempo_setup_min IS NULL OR tempo_setup_min >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  -- regras_precificacao percentuais
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_cf_override CHECK (pct_cf_override IS NULL OR (pct_cf_override >= 0 AND pct_cf_override <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_mo_override CHECK (pct_mo_override IS NULL OR (pct_mo_override >= 0 AND pct_mo_override <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_tf_override CHECK (pct_tf_override IS NULL OR (pct_tf_override >= 0 AND pct_tf_override <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_pct_tb CHECK (pct_tb IS NULL OR (pct_tb >= 0 AND pct_tb <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_pct_tr CHECK (pct_tr IS NULL OR (pct_tr >= 0 AND pct_tr <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_pct_dt CHECK (pct_dt IS NULL OR (pct_dt >= 0 AND pct_dt <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_margem_minima CHECK (margem_minima_pct IS NULL OR (margem_minima_pct >= 0 AND margem_minima_pct <= 100));
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_custo_ci_m2 CHECK (custo_ci_m2 IS NULL OR custo_ci_m2 >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER TABLE regras_precificacao ADD CONSTRAINT chk_rp_custo_ce_hora CHECK (custo_ce_hora IS NULL OR custo_ce_hora >= 0);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
