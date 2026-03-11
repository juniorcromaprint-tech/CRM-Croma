-- ============================================================
-- Migration 014: Descritivos Técnicos, Garantias e Markups
-- ============================================================
-- Objetivo: Atualizar os modelos de produto com:
--   1. Descritivos técnicos reais para uso em propostas/orçamentos
--   2. Versão curta do descritivo para NF (máx 120 chars)
--   3. Garantias por produto e linha de qualidade
--   4. Corrigir markup_padrao por categoria
--   5. Criar view vw_modelos_completos para o frontend
--
-- Depende de: migration 011 (criação dos produtos e modelos)
-- Idempotente: SIM (todos os comandos são UPDATE/CREATE OR REPLACE)
-- ============================================================

-- ============================================================
-- SEÇÃO 1: ADESIVOS COM RECORTE ELETRÔNICO (ADRE-001)
-- ============================================================

-- Modelo 1ª linha Oracal: vinil polimérico importado com maior durabilidade
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Adesivo RE 1ª linha: Adesivo feito em vinil colorido polimérico importado Oracal® alto brilho com recorte eletrônico em plotter. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Adesivo RE 1ª linha Oracal p/ Vinil colorido polimérico c/ RE em plotter',
  garantia_meses       = 24,
  garantia_descricao   = '2 anos da cola e desbotamento',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'ADRE-001'
  AND pm.nome ILIKE '%Oracal%';

-- Modelo 2ª linha Goldmax: vinil opaco nacional de menor durabilidade
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Adesivo RE 2ª linha: Adesivo feito em vinil colorido Goldmax® opaco com recorte eletrônico em plotter. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Adesivo RE 2ª linha Goldmax vinil colorido opaco c/ RE em plotter',
  garantia_meses       = 6,
  garantia_descricao   = '6 meses da cola e desbotamento',
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'ADRE-001'
  AND pm.nome ILIKE '%Goldmax%';


-- ============================================================
-- SEÇÃO 2: PLACAS DE ACM (PACM-001)
-- ============================================================

-- Modelo Premium: ACM poliéster + vinil Oracal RE + película antirreflexo
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Premium: Placa feita em chapa de ACM poliéster 3mm (lâmina 0,21mm), comunicação em vinil polimérico Importado Oracal® 651 recortado eletronicamente em Plotter, aplicação de película antirreflexo transparente Oracal® 651. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Placa ACM 3mm Poliéster + vinil Oracal RE + película antirreflexo Oracal 651',
  garantia_meses       = 36,
  garantia_descricao   = '3 anos da cola e desbotamento (via QR CODE)',
  linha_qualidade      = 'premium'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'PACM-001'
  AND pm.nome ILIKE '%Premium%';

-- Modelo 1ª linha: ACM poliéster + impressão solvente + película antirreflexo
UPDATE produto_modelos pm SET
  descritivo_tecnico   = '1ª linha: Placa feita em chapa de ACM poliéster 3mm (lâmina 0,21mm), comunicação em vinil monomérico com impressão digital solvente de 720dpis de resolução, inclui aplicação de película antirreflexo transparente Oracal® 651. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Placa ACM 3mm poliéster + imp. solvente 720dpi + película Oracal 651',
  garantia_meses       = 18,
  garantia_descricao   = '18 meses da cola e desbotamento (via QR CODE)',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'PACM-001'
  AND pm.nome ILIKE '%1ª linha%';

-- Modelo 2ª linha: ACM poliéster + impressão solvente sem película
UPDATE produto_modelos pm SET
  descritivo_tecnico   = '2ª linha: Placa feita em chapa de ACM poliéster 3mm (lâmina 0,21mm), comunicação em vinil monomérico com impressão digital solvente de 720dpis de resolução. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Placa ACM 3mm poliéster + impressão digital solvente 720dpi',
  garantia_meses       = 6,
  garantia_descricao   = '6 meses da cola e desbotamento (via QR CODE)',
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'PACM-001'
  AND pm.nome ILIKE '%2ª linha%';


-- ============================================================
-- SEÇÃO 3: PLACAS DE PVC (PPVC-001)
-- ============================================================

-- Modelo 1ª linha: PVC expandido + impressão solvente + película antirreflexo
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Placa PVC 1ª linha: Placa feita em chapa de PVC expandido 3mm, comunicação em vinil monomérico com impressão digital solvente de 720dpis de resolução, inclui aplicação de película antirreflexo transparente Oracal® 651. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Placa PVC expandido 3mm + imp.solvente 720dpi + película Oracal 651',
  garantia_meses       = 18,
  garantia_descricao   = '18 meses da cola e desbotamento (via QR CODE)',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'PPVC-001'
  AND pm.nome ILIKE '%1ª linha%';

-- Modelo 2ª linha: PVC expandido + impressão solvente sem película
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Placa PVC 2ª linha: Placa feita em chapa de PVC expandido 3mm, comunicação em vinil monomérico com impressão digital solvente de 720dpis de resolução. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Placa PVC expandido 3mm + impressão digital solvente 720dpi',
  garantia_meses       = 6,
  garantia_descricao   = '6 meses da cola e desbotamento (via QR CODE)',
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'PPVC-001'
  AND pm.nome ILIKE '%2ª linha%';


-- ============================================================
-- SEÇÃO 4: FACHADA / REVESTIMENTO ACM (FACM-001)
-- ============================================================

-- Modelo Poliéster: estrutura galvanizada 20x20mm + ACM poliéster 3mm + VHB 3M
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Revestimento ACM poliéster: Estrutura metálica feita por perfis galvanizados 20x20mm parede 1,25mm, corte e solda em meia esquadria com tratamento anticorrosivo nas soldas. Revestimento feito por ACM poliéster 3mm (lâmina 0,21mm), fixação por fita dupla face VHB 4910 3M®. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Revestimento ACM Poliéster 3mm c/ estrutura galv.20x20mm e fixação VHB 3M',
  garantia_meses       = 24,
  garantia_descricao   = '2 anos da estrutura e comunicação',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'FACM-001'
  AND pm.nome ILIKE '%Poliéster%';

-- Modelo Kynar: estrutura galvanizada 30x30mm + ACM Kynar 4mm + VHB 3M (linha premium)
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Revestimento ACM Kynar: Estrutura metálica feita por perfis galvanizados 30x30mm parede 1,25mm, corte e solda em meia esquadria com tratamento anticorrosivo nas soldas. Revestimento feito por ACM Kynar 4mm (lâmina 0,30mm), fixação por fita dupla face VHB 4910 3M®. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Revestimento ACM Kynar 4mm c/ estrutura galv.30x30mm e fixação VHB 3M',
  garantia_meses       = 36,
  garantia_descricao   = '3 anos da estrutura e comunicação',
  linha_qualidade      = 'premium'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'FACM-001'
  AND pm.nome ILIKE '%Kynar%';


-- ============================================================
-- SEÇÃO 5: LONA COM ILHÓS (LONIH-001)
-- ============================================================

-- Modelo 1ª linha 380g: trama densa + impressão UV Led de alta resolução + ilhós latão
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Lona front 1ª linha: Lona 380g de trama 1000x1000, com ilhós de Latão e comunicação por impressão digital UV Led de 1440dpis resolução. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Lona Front 380g UV LED 1440dpi + ilhós latão',
  garantia_meses       = 24,
  garantia_descricao   = '2 anos de desbotamento (garantia externa)',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'LONIH-001'
  AND pm.nome ILIKE '%380g%';

-- Modelo 2ª linha 440g: trama padrão + impressão solvente + ilhós metálico
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Lona Front 2ª linha: Lona 440g de trama 500x500, com ilhós metálico e comunicação por impressão digital solvente de 720dpis resolução. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Lona Front 440g solvente 720dpi + ilhós metálico',
  garantia_meses       = 6,
  garantia_descricao   = '6 meses de desbotamento (garantia externa)',
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'LONIH-001'
  AND pm.nome ILIKE '%440g%';


-- ============================================================
-- SEÇÃO 6: BANNER LONA (BAN-001)
-- ============================================================

-- Todos os modelos de banner recebem o mesmo descritivo (produto único de 2ª linha)
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Banner: feita em Lona 440g/m² com impressão digital solvente de 720dpis, inclui madeirites, ponteiras e corda para sustentação. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Banner lona 440g solvente 720dpi c/ madeirite, ponteira e corda',
  garantia_meses       = 6,
  garantia_descricao   = '6 meses de desbotamento',
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'BAN-001';


-- ============================================================
-- SEÇÃO 7: LETREIRO ACRÍLICO CRISTAL (LETAC-001)
-- ============================================================

-- Todos os modelos de letreiro acrílico (espessura varia por modelo,
-- o placeholder <espessura> é substituído em runtime pelo sistema de orçamento)
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Letreiro Acrílico: Feito em acrílico cristal <espessura>mm corte laser e polimento. Comunicação em adesivo transparente por impressão digital solvente de 720dpis e calço branco. Fixação por fita dupla face VHB 3M® (Inclui gabarito). Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Letreiro acrílico cristal <esp>mm c/ imp.solvente transparente e calço',
  garantia_meses       = 24,
  garantia_descricao   = '2 anos da fixação e comunicação',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'LETAC-001';


-- ============================================================
-- SEÇÃO 8: CARTÃO DE VISITAS (CTV-001)
-- ============================================================

-- Cartões não possuem garantia aplicável (produto gráfico consumível)

-- Modelo 1ª linha: couché 300g + laminação BOPP fosca + verniz UV localizado
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Cartão de visitas_1ª linha, papel couché 300g/m², impressão 4x4 (colorido frente e verso), laminação BOPP fosca e verniz UV localizado. Medidas: 9 x 5 cm.',
  descritivo_nf        = 'Cartão visitas 300g couché + lam.BOPP fosca + verniz UV loc. 4x4',
  garantia_meses       = 0,
  garantia_descricao   = NULL,
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'CTV-001'
  AND pm.nome ILIKE '%1ª linha%';

-- Modelo 2ª linha: couché 250g + verniz UV simples
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Cartão de visitas_2ª linha, feito em papel couché 250g/m², impressão 4x4 (frente e verso), verniz UV. Medidas: 9 x 5 cm.',
  descritivo_nf        = 'Cartão visitas 250g couché + verniz UV 4x4',
  garantia_meses       = 0,
  garantia_descricao   = NULL,
  linha_qualidade      = '2a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'CTV-001'
  AND pm.nome ILIKE '%2ª linha%';

-- Modelo Premium: couché 300g + laminação fosca F&V + hot stamping + offset 4x4
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Cartão de visitas_Premium: Feito em couché 300g/m², laminação fosca frente e verso, hot stamping (Metalizado qualquer cor) e impressão offset 4x4 (colorido frente e verso). Medidas: 9 x 5 cm.',
  descritivo_nf        = 'Cartão visitas 300g couché + lam.fosca + hot stamping + offset 4x4',
  garantia_meses       = 0,
  garantia_descricao   = NULL,
  linha_qualidade      = 'premium'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'CTV-001'
  AND pm.nome ILIKE '%Premium%';


-- ============================================================
-- SEÇÃO 9: CAVALETE METÁLICO (CAV-001)
-- ============================================================

-- Todos os modelos de cavalete compartilham o mesmo descritivo
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Cavalete: Estrutura metálica feita por perfis galvanizados 20x20mm parede 0,95mm, corte e solda em ½ esquadria, inclui pintura de acabamento e dobradiças e corda de acabamento. Comunicação em lona 440g por impressão digital solvente de 720dpis de resolução. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Cavalete metálico galv.20x20mm pintado + lona 440g solvente 720dpi',
  garantia_meses       = 12,
  garantia_descricao   = '12 meses da estrutura e comunicação',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'CAV-001';


-- ============================================================
-- SEÇÃO 10: TOTEM ACM (TOT-001)
-- ============================================================

-- Todos os modelos de totem compartilham o mesmo descritivo
-- (LED LightForce + relé fotoelétrico incluso)
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Totem ACM: Estrutura feita por perfis galvanizados com tratamento anticorrosivo nos pontos de solda. Revestimento feito por chapas de ACM poliéster 3mm (lâmina 0,21mm) alto brilho, corte em routter CNC. Iluminação feita por lâmpadas tuboled 18W / módulos de LED super branco 6500k LightForce®. Incluso instalação e ligação de relé fotoelétrico. Medidas: <largura> x <altura> m.',
  descritivo_nf        = 'Totem ACM Poliéster 3mm + estrutura galv. + LED LightForce + relé fotoelét.',
  garantia_meses       = 18,
  garantia_descricao   = '18 meses da comunicação e estrutura',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'TOT-001';


-- ============================================================
-- SEÇÃO 11: URNA DE ACRÍLICO (URNA-001)
-- ============================================================

-- Todos os modelos de urna (espessura varia por modelo,
-- o placeholder <espessura> é substituído em runtime)
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Urna acrílico: Feita em acrílico cristal incolor <espessura>mm com corte laser e polimento, colagem por Sinteglass®. Inclui dobradiças, trava para cadeado e cava superior para inserção de cédula.',
  descritivo_nf        = 'Urna acrílico cristal c/ corte laser, Sinteglass, dobradiças e trava',
  garantia_meses       = 12,
  garantia_descricao   = '12 meses do produto',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'URNA-001';


-- ============================================================
-- SEÇÃO 12: KIT REFLETOR LED (KLED-001)
-- ============================================================

-- Todos os modelos de kit LED compartilham o mesmo descritivo
UPDATE produto_modelos pm SET
  descritivo_tecnico   = 'Kit Iluminação: Refletor Led 6500k luz fria super branco, fixado em haste galvanizada pintada de preto. Incluso fiação e acendimento automático.',
  descritivo_nf        = 'KIT Refletor LED 6500k + haste galv. pintada + fiação + acend.automático',
  garantia_meses       = 12,
  garantia_descricao   = '12 meses do produto',
  linha_qualidade      = '1a'
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.codigo      = 'KLED-001';


-- ============================================================
-- SEÇÃO 13: CORREÇÃO DE MARKUP_PADRAO POR CATEGORIA
-- (modelos seeded pelas migrations 010/011)
-- ============================================================

-- Fachadas: markup de 60% (serviço com maior custo de mão de obra)
UPDATE produto_modelos pm SET
  markup_padrao = 60
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.categoria IN ('fachada', 'fachadas');

-- Letreiros: markup de 65% (produto elaborado com maior valor agregado)
UPDATE produto_modelos pm SET
  markup_padrao = 65
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.categoria IN ('letreiro', 'letreiros');

-- Luminosos: markup de 65% (mesmo racional dos letreiros — produto iluminado)
UPDATE produto_modelos pm SET
  markup_padrao = 65
FROM produtos p
WHERE pm.produto_id = p.id
  AND p.categoria IN ('luminoso', 'luminosos');


-- ============================================================
-- SEÇÃO 14: VIEW vw_modelos_completos
-- ============================================================
-- Consolida produto_modelos + produtos + categorias + contagem de
-- materiais e processos vinculados, facilitando queries do frontend
-- sem a necessidade de múltiplos JOINs repetitivos.
-- CREATE OR REPLACE garante idempotência total.
-- ============================================================

CREATE OR REPLACE VIEW vw_modelos_completos AS
SELECT
  pm.id,
  pm.produto_id,
  pm.nome,
  pm.largura_cm,
  pm.altura_cm,
  pm.area_m2,
  pm.markup_padrao,
  pm.margem_minima,
  pm.tempo_producao_min,
  pm.linha_qualidade,
  pm.descritivo_tecnico,
  pm.descritivo_nf,
  pm.garantia_meses,
  pm.garantia_descricao,
  pm.unidade_venda,
  pm.ativo,
  p.nome                       AS produto_nome,
  p.codigo                     AS produto_codigo,
  p.categoria                  AS produto_categoria,
  p.categoria_id               AS produto_categoria_id,
  p.requer_instalacao,
  p.tipo_checklist_instalacao,
  cat.nome                     AS categoria_nome,
  cat.slug                     AS categoria_slug,
  -- Quantidade de materiais cadastrados no modelo (para validação de completude)
  (SELECT COUNT(*)
     FROM modelo_materiais mm
    WHERE mm.modelo_id = pm.id) AS total_materiais,
  -- Quantidade de processos cadastrados no modelo (para validação de completude)
  (SELECT COUNT(*)
     FROM modelo_processos mp
    WHERE mp.modelo_id = pm.id) AS total_processos
FROM produto_modelos pm
JOIN produtos p       ON p.id   = pm.produto_id
LEFT JOIN categorias_produto cat ON cat.id = p.categoria_id
WHERE pm.ativo = TRUE
  AND p.ativo  = TRUE;

COMMENT ON VIEW vw_modelos_completos IS
  'View consolidada de modelos ativos com dados do produto, categoria, '
  'descritivos técnicos, garantias e contagem de materiais/processos. '
  'Usada pelo frontend para listagens e geração de propostas/orçamentos.';
