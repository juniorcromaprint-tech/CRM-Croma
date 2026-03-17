-- 052_seed_produtos_categorias.sql
-- Vincular produtos existentes às categorias criadas em 041

-- Banners e Faixas
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'banners' LIMIT 1
)
WHERE LOWER(categoria) LIKE '%banner%'
  OR LOWER(categoria) LIKE '%faixa%'
  OR LOWER(categoria) LIKE '%lona%'
  AND categoria_id IS NULL;

-- Adesivos
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1
)
WHERE LOWER(categoria) LIKE '%adesivo%'
  AND categoria_id IS NULL;

-- Fachadas e ACM
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'fachadas' LIMIT 1
)
WHERE (LOWER(categoria) LIKE '%fachada%' OR LOWER(categoria) LIKE '%acm%')
  AND categoria_id IS NULL;

-- Placas
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'placas' LIMIT 1
)
WHERE LOWER(categoria) LIKE '%placa%'
  AND categoria_id IS NULL;

-- Letreiros e Letras
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'letreiros' LIMIT 1
)
WHERE (LOWER(categoria) LIKE '%letreiro%' OR LOWER(categoria) LIKE '%letra%' OR LOWER(categoria) LIKE '%luminoso%')
  AND categoria_id IS NULL;

-- Painéis e Totens
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'paineis' LIMIT 1
)
WHERE (LOWER(categoria) LIKE '%painel%' OR LOWER(categoria) LIKE '%totem%' OR LOWER(categoria) LIKE '%display%')
  AND categoria_id IS NULL;

-- Envelopamento
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'envelopamento' LIMIT 1
)
WHERE LOWER(categoria) LIKE '%envelop%'
  AND categoria_id IS NULL;

-- PDV e Display
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'pdv' LIMIT 1
)
WHERE (LOWER(categoria) LIKE '%pdv%' OR LOWER(categoria) LIKE '%ponto de venda%')
  AND categoria_id IS NULL;

-- Serviços
UPDATE produtos SET categoria_id = (
  SELECT id FROM categorias_produto WHERE slug = 'servicos' LIMIT 1
)
WHERE (LOWER(categoria) LIKE '%servi%' OR LOWER(categoria) LIKE '%instala%')
  AND categoria_id IS NULL;

-- Atualizar percentual_desperdicio realista nos materiais do BOM
UPDATE modelo_materiais mm
SET percentual_desperdicio = CASE
  WHEN EXISTS (
    SELECT 1 FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE pm.id = mm.modelo_id
      AND (LOWER(p.categoria) LIKE '%banner%' OR LOWER(p.categoria) LIKE '%lona%')
  ) THEN 15
  WHEN EXISTS (
    SELECT 1 FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE pm.id = mm.modelo_id
      AND LOWER(p.categoria) LIKE '%adesivo%'
  ) THEN 20
  WHEN EXISTS (
    SELECT 1 FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE pm.id = mm.modelo_id
      AND (LOWER(p.categoria) LIKE '%acm%' OR LOWER(p.categoria) LIKE '%fachada%')
  ) THEN 5
  ELSE 10
END
WHERE percentual_desperdicio = 0
  AND mm.modelo_id IN (SELECT id FROM produto_modelos WHERE ativo = true);
