-- Backfill Gantt — Ciclo autônomo #17 (2026-05-28 Quinta)
--
-- CONTEXTO: GAP-04 falso-positivo reaberto pelo agent #16 (Gantt decorativo: só 1/6 OPs
-- com data_inicio_prevista/data_fim_prevista populados, 0 producao_etapas com template_id).
-- Reabriu como NEXT P2 default executável. Este ciclo aplica em 3 passos cascateados.
--
-- IDEMPOTENTE: WHERE em cada UPDATE pula registros já populados.
-- Re-execução = no-op. Não-destrutivo.

-- PASSO 1: Backfill producao_etapas.template_id (FK órfã) via match por nome normalizado.
-- 19 etapas atingidas no ciclo #17. WHERE template_id IS NULL preserva linkadas posteriormente.
UPDATE producao_etapas pe SET template_id =
  CASE
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(criacao|arte)'
      THEN 'fe69433c-bf41-49d9-830e-4f37d846b426'::uuid -- Pré-impressão (30min)
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(impressao|latex)'
      THEN 'bd29ce6c-07d8-4348-a917-6ec4642f091f'::uuid -- Impressão Latex (90min)
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(acabamento|lamin|refilo)'
      THEN 'd4e10b23-63a4-453d-bf9d-5632b03bf2e7'::uuid -- Acabamento (60min)
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(router|cnc|corte)'
      THEN 'b786af53-ca54-467e-8d4a-0bd0c79ecd56'::uuid -- Router (45min)
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(conferencia|embalagem)'
      THEN '14243df0-7ea5-43f3-8309-00e4a687a98d'::uuid -- Conferência (30min)
    WHEN lower(translate(pe.nome,'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) ~ '(expedicao|entrega)'
      THEN '678d9728-ccca-4dbf-97ae-ff15abf6370c'::uuid -- Expedição (30min)
    ELSE template_id
  END
WHERE template_id IS NULL;

-- PASSO 2: Sync tempo_estimado_min via template (apenas onde está 0)
UPDATE producao_etapas pe
SET tempo_estimado_min = et.tempo_estimado_min
FROM etapa_templates et
WHERE pe.template_id = et.id AND pe.tempo_estimado_min = 0;

-- PASSO 3: Backfill ordens_producao.tempo_estimado_min via SUM(DISTINCT template_id)
-- DISTINCT pra deduplicar etapas duplicadas (OP-0015 tem 9 etapas, esperado 5). Fallback 240min.
UPDATE ordens_producao op SET tempo_estimado_min = COALESCE(NULLIF(agg.total_min,0), 240)
FROM (
  SELECT op.id as op_id, COALESCE(SUM(DISTINCT_PE.tempo_estimado_min),0) as total_min
  FROM ordens_producao op
  LEFT JOIN LATERAL (
    SELECT DISTINCT ON (pe.template_id) pe.template_id, pe.tempo_estimado_min
    FROM producao_etapas pe
    WHERE pe.ordem_producao_id = op.id AND pe.template_id IS NOT NULL
    ORDER BY pe.template_id, pe.tempo_estimado_min DESC NULLS LAST
  ) DISTINCT_PE ON true
  WHERE op.excluido_em IS NULL
  GROUP BY op.id
) agg
WHERE op.id = agg.op_id AND COALESCE(op.tempo_estimado_min,0) = 0;

-- PASSO 4: Backfill data_inicio_prevista + data_fim_prevista (cascade tempo)
UPDATE ordens_producao op
SET data_inicio_prevista = COALESCE(op.data_inicio, op.created_at),
    data_fim_prevista = COALESCE(op.data_inicio, op.created_at) + (op.tempo_estimado_min * INTERVAL '1 minute')
WHERE op.excluido_em IS NULL
  AND (op.data_inicio_prevista IS NULL OR op.data_fim_prevista IS NULL)
  AND op.tempo_estimado_min > 0;

-- VALIDACAO POS-MIGRATION (não DDL, só inspeção):
-- SELECT
--   (SELECT COUNT(*) FILTER (WHERE data_inicio_prevista IS NOT NULL AND data_fim_prevista IS NOT NULL) FROM ordens_producao WHERE excluido_em IS NULL) as ops_com_prazo,
--   (SELECT COUNT(*) FROM ordens_producao WHERE excluido_em IS NULL) as ops_total;
-- Esperado: ops_com_prazo = ops_total (100%)
