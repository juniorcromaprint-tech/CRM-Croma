-- =============================================================================
-- Migration 009: Seed produto_modelos + markups Mubisys
-- Data: 2026-03-10
-- Contexto: produtos.nome contém nomes de modelos (ex: '100x150', '2mm')
--           sem coluna markup_padrao — adicionada aqui.
--           produto_modelos estava vazio — populado com 1 modelo por produto.
-- =============================================================================

-- 1. Adicionar colunas de markup diretamente em produtos
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS markup_padrao NUMERIC(5,2) DEFAULT 45,
  ADD COLUMN IF NOT EXISTS margem_minima NUMERIC(5,2) DEFAULT 15;

-- 2. Atualizar markups por nome de modelo (produtos.nome = Mubisys "Modelo")
UPDATE produtos p
SET markup_padrao = d.markup, margem_minima = COALESCE(d.marg, 15), updated_at = NOW()
FROM (VALUES
  ('Bandejado',                                                            45.0, 15.0::numeric),
  ('Por metro',                                                            45.0, 15.0::numeric),
  ('100x120',                                                             100.0, 10.0::numeric),
  ('100x150',                                                             100.0, 10.0::numeric),
  ('60x100',                                                              100.0, 10.0::numeric),
  ('60x80',                                                               100.0, 10.0::numeric),
  ('60x90',                                                               100.0, 50.0::numeric),
  ('70x100',                                                              100.0, 10.0::numeric),
  ('80x100',                                                              100.0, 10.0::numeric),
  ('80x120',                                                              100.0, 10.0::numeric),
  ('Por m² Personalizado',                                                 30.0, 10.0::numeric),
  ('SUBLIMAÇÃO',                                                           60.0, 10.0::numeric),
  ('Calha Galvanizada #26',                                                40.0, 10.0::numeric),
  ('Rufo Galvanizado #26',                                                 40.0, 10.0::numeric),
  ('TAMANHOS ESPECIAIS',                                                   60.0, 10.0::numeric),
  ('Papel Sintético',                                                     100.0, 15.0::numeric),
  ('A1',                                                                   80.0, 10.0::numeric),
  ('A2',                                                                   80.0, 10.0::numeric),
  ('A3',                                                                   60.0, 15.0::numeric),
  ('A4',                                                                   80.0, 10.0::numeric),
  ('A5',                                                                   60.0, 10.0::numeric),
  ('53x98',                                                                60.0, 15.0::numeric),
  ('Telha Trapezoidal',                                                    40.0, 10.0::numeric),
  ('2mm',                                                                  60.0, 10.0::numeric),
  ('3mm',                                                                  60.0, 10.0::numeric),
  ('4mm',                                                                  60.0, 10.0::numeric),
  ('5mm',                                                                  60.0, 10.0::numeric),
  ('1,5mm',                                                                60.0, 10.0::numeric),
  ('6mm',                                                                  60.0, 10.0::numeric),
  ('8mm',                                                                  60.0, 10.0::numeric),
  ('49x8',                                                                 60.0, 15.0::numeric),
  ('8 dobras',                                                             40.0, 10.0::numeric),
  ('PVC',                                                                  40.0,  1.0::numeric),
  ('Bloco',                                                                60.0, 10.0::numeric),
  ('Até 10cm',                                                            100.0, 15.0::numeric),
  ('de 11 a 20 cm',                                                       100.0, 15.0::numeric),
  ('de 21 a 30 cm',                                                       100.0, 15.0::numeric),
  ('de 31 a 50 cm',                                                       100.0, 15.0::numeric),
  ('de 50 a 100 cm',                                                       80.0, 15.0::numeric),
  ('Colorido 2mm',                                                        100.0, 15.0::numeric),
  ('Colorido 2mm Com Led',                                                100.0, 15.0::numeric),
  ('Transparente 2mm Adesivado',                                          100.0, 15.0::numeric),
  ('20mm Pintura Automotiva',                                             100.0, 15.0::numeric),
  ('25mm Pintura latex Frente PS 2mm - Adesivado',                        60.0, 15.0::numeric),
  ('50mm Pintura latex',                                                   60.0, 15.0::numeric),
  ('50mm Pintura latex Frente PS 2mm - Adesivado',                        60.0, 15.0::numeric),
  ('25mm Pintura latex',                                                   60.0, 15.0::numeric),
  ('Frente em Acrílico Transparente 3mm/ Laterais ACM',                   40.0, 10.0::numeric),
  ('Frente em Acrílico Transparente 3mm/ Laterais Galvanizada #26',       40.0, 10.0::numeric),
  ('Frente em Lona Impressa / Laterais Galvanizada #26 (cópia)',          40.0, 10.0::numeric),
  ('P.s 1mm adesivado',                                                    80.0, 10.0::numeric),
  ('Estojo',                                                               60.0, 10.0::numeric),
  ('P.s 0,5mm adesivado',                                                  60.0, 10.0::numeric),
  ('10mm',                                                                 60.0, 10.0::numeric),
  ('1.5mm',                                                               100.0, 15.0::numeric),
  ('1mm',                                                                 100.0, 15.0::numeric),
  ('Puff G 40x40x45',                                                      30.0, 10.0::numeric),
  ('Puff P 28x28x30',                                                      60.0, 10.0::numeric),
  ('Ferro 20 x 20 - Com lona impressão digital',                          40.0, 10.0::numeric),
  ('Ferro 30 x 20 - Com lona impressão digital',                          40.0, 10.0::numeric),
  ('Ferro 30 x 20 - Com lona impressão digital + Cantoneira de Almuninio',40.0, 10.0::numeric),
  ('Perfil - U 2P',                                                        40.0, 10.0::numeric),
  ('Perfil - U 3P',                                                        40.0, 10.0::numeric),
  ('65x130 com pé',                                                        35.0, 10.0::numeric),
  ('12x12 cm + haste 14,3 cm',                                            60.0, 10.0::numeric),
  ('13x13cm + haste 14,3 cm',                                            100.0, 15.0::numeric),
  ('15x15 cm + haste 14,3 cm',                                            60.0, 10.0::numeric),
  ('29x29',                                                                60.0, 15.0::numeric),
  ('56,7x27,7',                                                            60.0, 10.0::numeric),
  ('60x40',                                                                20.0,  5.0::numeric)
) AS d(nome, markup, marg)
WHERE lower(trim(p.nome)) = lower(trim(d.nome));

-- 3. Limpar produto_modelos e re-sedar com 1 modelo por produto
DELETE FROM produto_modelos;

INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima)
SELECT id, nome, markup_padrao, margem_minima
FROM produtos
WHERE ativo = true;

-- Verificar resultado
SELECT
  (SELECT count(*) FROM produtos WHERE markup_padrao != 45) AS produtos_com_markup_custom,
  (SELECT count(*) FROM produto_modelos) AS total_modelos,
  round(avg(markup_padrao), 1) AS media_markup_produtos
FROM produtos;

COMMENT ON COLUMN produtos.markup_padrao IS 'Markup padrão Mubisys (%). Adicionado em migration 009.';
COMMENT ON COLUMN produtos.margem_minima IS 'Margem mínima Mubisys (%). Adicionado em migration 009.';
