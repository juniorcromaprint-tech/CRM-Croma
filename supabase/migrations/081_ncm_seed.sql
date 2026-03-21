-- Migration 081: Seed NCM padrão para modelos sem NCM
-- NCMs para comunicação visual:
-- 4911.10.10 — cartazes impressos
-- 3919.90.00 — adesivos de plástico
-- 6307.90.99 — artigos de uso técnico têxtil (banners lona)
-- 4911.99.99 — outros impressos
-- 7326.90.90 — artigos de ferro/aço (estruturas metálicas)
-- 3920.10.99 — chapas/placas plástico
-- 9405.40.90 — letreiros luminosos

-- Banners, lonas, faixas → NCM banner lona
UPDATE produto_modelos
SET ncm = '6307.90.99'
WHERE ncm IS NULL
  AND EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = produto_modelos.produto_id
    AND (
      LOWER(p.nome) LIKE '%banner%' OR
      LOWER(p.nome) LIKE '%lona%' OR
      LOWER(p.nome) LIKE '%faixa%' OR
      LOWER(p.nome) LIKE '%backdrop%'
    )
  );

-- Adesivos → NCM adesivo plástico
UPDATE produto_modelos
SET ncm = '3919.90.00'
WHERE ncm IS NULL
  AND EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = produto_modelos.produto_id
    AND (
      LOWER(p.nome) LIKE '%adesivo%' OR
      LOWER(p.nome) LIKE '%vinil%' OR
      LOWER(p.nome) LIKE '%envelopamento%'
    )
  );

-- Placas → NCM chapa plástico
UPDATE produto_modelos
SET ncm = '3920.10.99'
WHERE ncm IS NULL
  AND EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = produto_modelos.produto_id
    AND (
      LOWER(p.nome) LIKE '%placa%' OR
      LOWER(p.nome) LIKE '%ps%' OR
      LOWER(p.nome) LIKE '%painel%'
    )
  );

-- Fachadas, letreiros, totens com estrutura → NCM estrutura metálica
UPDATE produto_modelos
SET ncm = '7326.90.90'
WHERE ncm IS NULL
  AND EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = produto_modelos.produto_id
    AND (
      LOWER(p.nome) LIKE '%fachada%' OR
      LOWER(p.nome) LIKE '%totem%' OR
      LOWER(p.nome) LIKE '%letreiro%' OR
      LOWER(p.nome) LIKE '%letra%'
    )
  );

-- Luminosos, caixas de luz → NCM letreiro luminoso
UPDATE produto_modelos
SET ncm = '9405.40.90'
WHERE ncm IS NULL
  AND EXISTS (
    SELECT 1 FROM produtos p
    WHERE p.id = produto_modelos.produto_id
    AND (
      LOWER(p.nome) LIKE '%luminoso%' OR
      LOWER(p.nome) LIKE '%led%' OR
      LOWER(p.nome) LIKE '%caixa de luz%' OR
      LOWER(p.nome) LIKE '%backlit%'
    )
  );

-- Tudo que ainda está NULL → NCM genérico outros impressos
UPDATE produto_modelos
SET ncm = '4911.99.99'
WHERE ncm IS NULL;

-- Documentar o campo
COMMENT ON COLUMN produto_modelos.ncm IS 'NCM obrigatório para emissão de NF-e. Seed padrão: 4911.99.99 (outros impressos). Atualizar conforme produto real.';
