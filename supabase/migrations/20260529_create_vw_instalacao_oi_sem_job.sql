-- Migration: create_vw_instalacao_oi_sem_job (INSTAL-03 observabilidade)
-- Ciclo autonomo #28 - 2026-05-29 01:07 BRT
-- View read-only que expoe OIs ativas sem job vinculado (skip silencioso de fn_create_job_from_ordem).
-- Risco-zero: nao altera comportamento de nenhum objeto existente; apenas leitura.
-- Aplicada em prod via apply_migration (MCP) no ciclo #28. Arquivo versionado para evitar drift source<->DB.
-- 17 colunas verificadas via information_schema antes do apply.
CREATE OR REPLACE VIEW vw_instalacao_oi_sem_job AS
SELECT
  oi.id,
  oi.numero,
  oi.status,
  oi.data_agendada,
  CASE
    WHEN EXISTS(SELECT 1 FROM stores s WHERE s.id = oi.store_id AND s.deleted_at IS NULL)
      THEN 'store_direto'
    WHEN oi.unidade_id IS NOT NULL AND EXISTS(SELECT 1 FROM stores s WHERE s.cliente_unidade_id = oi.unidade_id AND s.deleted_at IS NULL)
      THEN 'store_unidade'
    WHEN oi.cliente_id IS NOT NULL AND oi.endereco_completo IS NOT NULL
      AND EXISTS(SELECT 1 FROM stores s WHERE s.cliente_id = oi.cliente_id AND s.address = SPLIT_PART(oi.endereco_completo, ' - ', 1) AND s.deleted_at IS NULL)
      THEN 'store_heuristico'
    ELSE 'sem_store'
  END AS flag_store,
  CASE WHEN oi.data_agendada IS NULL THEN 'sem_data' ELSE 'data_ok' END AS flag_data,
  CASE
    WHEN NOT EXISTS(SELECT 1 FROM stores s WHERE (s.id = oi.store_id OR s.cliente_unidade_id = oi.unidade_id) AND s.deleted_at IS NULL)
      AND NOT (oi.cliente_id IS NOT NULL AND oi.endereco_completo IS NOT NULL
        AND EXISTS(SELECT 1 FROM stores s WHERE s.cliente_id = oi.cliente_id AND s.address = SPLIT_PART(oi.endereco_completo, ' - ', 1) AND s.deleted_at IS NULL))
      AND oi.data_agendada IS NULL THEN 'skip_duplo'
    WHEN NOT EXISTS(SELECT 1 FROM stores s WHERE (s.id = oi.store_id OR s.cliente_unidade_id = oi.unidade_id) AND s.deleted_at IS NULL)
      AND NOT (oi.cliente_id IS NOT NULL AND oi.endereco_completo IS NOT NULL
        AND EXISTS(SELECT 1 FROM stores s WHERE s.cliente_id = oi.cliente_id AND s.address = SPLIT_PART(oi.endereco_completo, ' - ', 1) AND s.deleted_at IS NULL))
      THEN 'skip_store'
    WHEN oi.data_agendada IS NULL THEN 'skip_data'
    ELSE 'ok_sem_job'
  END AS motivo_ausencia_job,
  oi.created_at
FROM ordens_instalacao oi
WHERE oi.excluido_em IS NULL
  AND oi.status NOT IN ('cancelada', 'concluida')
  AND NOT EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.ordem_instalacao_id = oi.id
      AND j.deleted_at IS NULL
  );

COMMENT ON VIEW vw_instalacao_oi_sem_job IS 'INSTAL-03 (ciclo autonomo #28): OIs ativas sem job vinculado (skip silencioso de fn_create_job_from_ordem). motivo_ausencia_job: skip_store|skip_data|skip_duplo|ok_sem_job. Observabilidade do gap; chain instalacao morta desde 2026-05-05.';
