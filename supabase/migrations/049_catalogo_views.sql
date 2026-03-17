-- Migration 049: Views computadas do catálogo de produtos
-- Criado em: 2026-03-17
-- Descrição: Views para custo completo BOM por modelo e materiais sem preço

-- ============================================================
-- VIEW 1: v_produto_custo_completo
-- Custo total de cada modelo baseado na composição BOM
-- ============================================================
CREATE OR REPLACE VIEW v_produto_custo_completo AS
WITH custo_materiais AS (
  SELECT
    mm.modelo_id,
    COUNT(DISTINCT mm.material_id)                        AS qtd_materiais,
    SUM(
      COALESCE(
        -- override local tem precedência
        mm.custo_unitario,
        -- cálculo via preço do material com desperdício
        m.preco_medio
          * mm.quantidade_por_unidade
          * (1 + COALESCE(mm.percentual_desperdicio, 0) / 100.0)
      )
    )                                                     AS custo_materiais
  FROM modelo_materiais mm
  JOIN materiais m ON m.id = mm.material_id
  GROUP BY mm.modelo_id
),
custo_processos AS (
  SELECT
    mp.modelo_id,
    COUNT(*)                                              AS qtd_processos,
    SUM(
      COALESCE(mp.custo_unitario, 0)
    )                                                     AS custo_processos
  FROM modelo_processos mp
  GROUP BY mp.modelo_id
)
SELECT
  p.id                                                    AS produto_id,
  pm.id                                                   AS modelo_id,
  p.nome                                                  AS produto_nome,
  pm.nome                                                 AS modelo_nome,
  COALESCE(pm.markup_padrao, p.markup_padrao)             AS markup_padrao,
  COALESCE(pm.margem_minima, p.margem_minima)             AS margem_minima,
  COALESCE(cm.custo_materiais, 0)                         AS custo_materiais,
  COALESCE(cp.custo_processos, 0)                         AS custo_processos,
  COALESCE(cm.custo_materiais, 0)
    + COALESCE(cp.custo_processos, 0)                     AS custo_total_bom,
  COALESCE(cm.qtd_materiais, 0)                           AS qtd_materiais,
  COALESCE(cp.qtd_processos, 0)                           AS qtd_processos
FROM produto_modelos pm
JOIN produtos p ON p.id = pm.produto_id
LEFT JOIN custo_materiais cm ON cm.modelo_id = pm.id
LEFT JOIN custo_processos cp ON cp.modelo_id = pm.id
WHERE pm.ativo = true;

-- ============================================================
-- VIEW 2: v_material_sem_preco
-- Materiais referenciados em composições BOM sem preço cadastrado
-- ============================================================
CREATE OR REPLACE VIEW v_material_sem_preco AS
SELECT
  m.id                                                    AS material_id,
  m.codigo,
  m.nome                                                  AS material_nome,
  m.categoria,
  m.unidade,
  m.preco_medio,
  COUNT(DISTINCT mm.modelo_id)                            AS qtd_modelos_afetados
FROM materiais m
JOIN modelo_materiais mm ON mm.material_id = m.id
WHERE
  (m.preco_medio IS NULL OR m.preco_medio = 0)
  AND mm.custo_unitario IS NULL
GROUP BY
  m.id,
  m.codigo,
  m.nome,
  m.categoria,
  m.unidade,
  m.preco_medio;

-- ============================================================
-- Permissões
-- ============================================================
GRANT SELECT ON v_produto_custo_completo TO anon, authenticated;
GRANT SELECT ON v_material_sem_preco TO anon, authenticated;
