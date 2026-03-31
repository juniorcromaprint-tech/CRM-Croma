-- ============================================================================
-- 015_produtos_excel.sql — Produtos da tabela de produtos Croma Print
-- Importação da planilha: Tabela de Produtos - Croma.xlsx
-- ============================================================================

DO $$
DECLARE
  v_produto_id UUID;
  v_cat_id UUID;
BEGIN

  -- Adesivo  jateado
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Adesivo  jateado' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Adesivo  jateado', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Adesivo  jateado' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Laminação') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Laminação', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Impresso') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Impresso', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Impresso + recorte eletrônico') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Impresso + recorte eletrônico', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Com recorte eletrônico') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Com recorte eletrônico', 40, 20, true);
    END IF;
  END IF;

  -- Adesivo  Recorte eletrônico
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Adesivo  Recorte eletrônico' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Adesivo  Recorte eletrônico', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Adesivo  Recorte eletrônico' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Oracal/Similar_1cor') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Oracal/Similar_1cor', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Oracal/Similar_2cores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Oracal/Similar_2cores', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Color_Goldmax_1cor') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Color_Goldmax_1cor', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Color_Goldmax_2cores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Color_Goldmax_2cores', 40, 20, true);
    END IF;
  END IF;

  -- Adesivo Blackout Impresso
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Adesivo Blackout Impresso' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Adesivo Blackout Impresso', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Adesivo Blackout Impresso' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Impresso + Laminação Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Impresso + Laminação Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Impresso + Laminação Fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Impresso + Laminação Fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Impresso Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Impresso Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Impresso + Laminação Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Impresso + Laminação Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Impresso + Laminação Fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Impresso + Laminação Fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Impresso') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Impresso', 40, 20, true);
    END IF;
  END IF;

  -- Adesivo Leitoso Impresso
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Adesivo Leitoso Impresso' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Adesivo Leitoso Impresso', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Adesivo Leitoso Impresso' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha:  Brilho + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha:  Brilho + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha:  Fosco + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha:  Fosco + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha:  Brilho + Recorte + mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha:  Brilho + Recorte + mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Recorte + mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Recorte + mascara Transparente', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha:Fosco + Recorte + Mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha:Fosco + Recorte + Mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Fosco + Recorte + Mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Fosco + Recorte + Mascara Transparente', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Laminação Fosca') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Laminação Fosca', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Laminação Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Laminação Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Laminação Brilho + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Laminação Brilho + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha:Brilho + Laminação Fosca + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha:Brilho + Laminação Fosca + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Laminação Fosca + Recorte + Mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Laminação Fosca + Recorte + Mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Brilho + Laminação Fosca + Recorte + Mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Brilho + Laminação Fosca + Recorte + Mascara Transparente', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Brilho + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Brilho + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Fosco + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Fosco + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Recorte + mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Recorte + mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Recorte + mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Recorte + mascara Transparente', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Fosco + Recorte + Mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Fosco + Recorte + Mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Fosco + Recorte + Mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Fosco + Recorte + Mascara Transparente', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Fosca') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Fosca', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Brilho + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Brilho + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Fosca + Recorte') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Fosca + Recorte', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Fosca + Recorte + Mascara Papel') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Fosca + Recorte + Mascara Papel', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha:  Brilho + Laminação Fosca + Recorte + Mascara Transparente') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha:  Brilho + Laminação Fosca + Recorte + Mascara Transparente', 40, 20, true);
    END IF;
  END IF;

  -- Adesivo Perfurado
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Adesivo Perfurado' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Adesivo Perfurado', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Adesivo Perfurado' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Impressão Solvente 1ª linha') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Impressão Solvente 1ª linha', 40, 20, true);
    END IF;
  END IF;

  -- Banner Lona
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Banner Lona' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Banner Lona', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Banner Lona' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '40x60cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '40x60cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '80x60cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '80x60cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '60x100cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '60x100cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '80x100cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '80x100cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '80x120cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '80x120cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '100x120cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '100x120cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '100x150cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '100x150cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '100x200') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '100x200', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '120x200') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '120x200', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Por m²_Personalizado') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Por m²_Personalizado', 40, 20, true);
    END IF;
  END IF;

  -- Banner tecido
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Banner tecido' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Banner tecido', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Banner tecido' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento banner Tubo alumínio') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento banner Tubo alumínio', 40, 20, true);
    END IF;
  END IF;

  -- Bolsa de PETG/Acrílico/PS/Acetato
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Bolsa de PETG/Acrílico/PS/Acetato' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Bolsa de PETG/Acrílico/PS/Acetato', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Bolsa de PETG/Acrílico/PS/Acetato' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A3 parede (42x30cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A3 parede (42x30cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A3 parede 25mm (42x30cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A3 parede 25mm (42x30cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A4 parede (30x21cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A4 parede (30x21cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A4 parede 25mm (30x21cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A4 parede 25mm (30x21cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A4 Duplo c/ fundo (30x21cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A4 Duplo c/ fundo (30x21cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A5 parede (21x15cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A5 parede (21x15cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A5 parede 25mm (21x15cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A5 parede 25mm (21x15cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A6 parede Simples (15x10cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A6 parede Simples (15x10cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'A7 parede Simples (10x7,5cm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'A7 parede Simples (10x7,5cm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Projeto Personalizado') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Projeto Personalizado', 40, 20, true);
    END IF;
  END IF;

  -- Cartão de Visitas
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'grafica' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Cartão de Visitas' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Cartão de Visitas', 'grafica', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Cartão de Visitas' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: 300g+Lam. Fosca+Verniz loc.+4x4') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: 300g+Lam. Fosca+Verniz loc.+4x4', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: 300g+Verniz+4x4') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: 300g+Verniz+4x4', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Premium: 300g+Lam. Fosca+hot Stamping+4x4') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Premium: 300g+Lam. Fosca+hot Stamping+4x4', 40, 20, true);
    END IF;
  END IF;

  -- Cartela de Etiqueta
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'grafica' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Cartela de Etiqueta' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Cartela de Etiqueta', 'grafica', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Cartela de Etiqueta' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: P_A4 - Solvente+Película+Corte contorno') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: P_A4 - Solvente+Película+Corte contorno', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: P_A4 - Solvente+Corte contorno') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: P_A4 - Solvente+Corte contorno', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: M_A3 - Solvente+Película+Corte contorno') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: M_A3 - Solvente+Película+Corte contorno', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: M_A3 - Solvente+Corte contorno') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: M_A3 - Solvente+Corte contorno', 40, 20, true);
    END IF;
  END IF;

  -- Cavalete metálico
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Cavalete metálico' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Cavalete metálico', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Cavalete metálico' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 60x80cm_1 face') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 60x80cm_1 face', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 60x80cm_2 faces') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 60x80cm_2 faces', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 80x120cm_1 face') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 80x120cm_1 face', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 80x120cm_2 faces') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 80x120cm_2 faces', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 100x150cm_1 face') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 100x150cm_1 face', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 100x150cm_2 faces') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 100x150cm_2 faces', 40, 20, true);
    END IF;
  END IF;

  -- Corte em CNC (m²)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'servicos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Corte em CNC (m²)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Corte em CNC (m²)', 'servicos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Corte em CNC (m²)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Área quadrada - Materiais Diversos') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Área quadrada - Materiais Diversos', 40, 20, true);
    END IF;
  END IF;

  -- Corte em Router (m²)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'servicos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Corte em Router (m²)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Corte em Router (m²)', 'servicos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Corte em Router (m²)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Área quadrada - Materiais Diversos') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Área quadrada - Materiais Diversos', 40, 20, true);
    END IF;
  END IF;

  -- Corte em Router
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'servicos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Corte em Router' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Corte em Router', 'servicos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Corte em Router' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Área quadrada 3 a 5mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Área quadrada 3 a 5mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Área quadrada 10mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Área quadrada 10mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Área quadrada 20mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Área quadrada 20mm', 40, 20, true);
    END IF;
  END IF;

  -- Criação e Arte final
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'servicos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Criação e Arte final' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Criação e Arte final', 'servicos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Criação e Arte final' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Hora homem') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Hora homem', 40, 20, true);
    END IF;
  END IF;

  -- Faixa
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Faixa' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Faixa', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Faixa' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 200x60cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 200x60cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 200x100cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 200x100cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 300x80cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 300x80cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 300x120cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 300x120cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 400x80cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 400x80cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 400x120cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 400x120cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Por m²_Personalizado') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Por m²_Personalizado', 40, 20, true);
    END IF;
  END IF;

  -- Imantado 0,4mm
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Imantado 0,4mm' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Imantado 0,4mm', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Imantado 0,4mm' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação fosco + Corte especial') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação fosco + Corte especial', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação brilho + Corte especial') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação brilho + Corte especial', 40, 20, true);
    END IF;
  END IF;

  -- Imantado 0,8mm
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'adesivos' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Imantado 0,8mm' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Imantado 0,8mm', 'adesivos', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Imantado 0,8mm' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação fosco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação fosco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação fosco + Corte especial') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação fosco + Corte especial', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Adesivo impresso + Laminação brilho + Corte especial') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Adesivo impresso + Laminação brilho + Corte especial', 40, 20, true);
    END IF;
  END IF;

  -- Lona com ilhós
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Lona com ilhós' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Lona com ilhós', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Lona com ilhós' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 380g Fosca + Ihós Latão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 380g Fosca + Ihós Latão', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 380g Brilho + Ihós Latão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 380g Brilho + Ihós Latão', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 440g Fosca + Ihós Latão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 440g Fosca + Ihós Latão', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 440g Brilho + Ihós Latão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 440g Brilho + Ihós Latão', 40, 20, true);
    END IF;
  END IF;

  -- Lona sem Acabamento
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Lona sem Acabamento' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Lona sem Acabamento', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Lona sem Acabamento' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 380g Fosca') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 380g Fosca', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 380g Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 380g Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 440g Fosca') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 440g Fosca', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Front 440g Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Front 440g Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Back 440g Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Back 440g Brilho', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Sem trama 330g semi-Brilho') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Sem trama 330g semi-Brilho', 40, 20, true);
    END IF;
  END IF;

  -- Mobile Impresso 4x4
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Mobile Impresso 4x4' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Mobile Impresso 4x4', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Mobile Impresso 4x4' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 30cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 30cmØ', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 40cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 40cmØ', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 50cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 50cmØ', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte especial por m²') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte especial por m²', 40, 20, true);
    END IF;
  END IF;

  -- Mobile Papel 4x4
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Mobile Papel 4x4' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Mobile Papel 4x4', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Mobile Papel 4x4' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 30cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 30cmØ', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 40cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 40cmØ', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 50cmØ') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 50cmØ', 40, 20, true);
    END IF;
  END IF;

  -- Painel transparente + Prolongador
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Painel transparente + Prolongador' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Painel transparente + Prolongador', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Painel transparente + Prolongador' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Vidro M_8mm Temp. + Adesivo Transp. + Calço') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Vidro M_8mm Temp. + Adesivo Transp. + Calço', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acrílico P_3mm Cristal + Adesivo Transp. + Calço') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acrílico P_3mm Cristal + Adesivo Transp. + Calço', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acrílico M_5mm Cristal + Adesivo Transp. + Calço') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acrílico M_5mm Cristal + Adesivo Transp. + Calço', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'ACM: 3mm + Adesivo Solvente + Memoboard') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'ACM: 3mm + Adesivo Solvente + Memoboard', 40, 20, true);
    END IF;
  END IF;

  -- Placa de FOAM
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de FOAM' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de FOAM', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de FOAM' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: 5mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: 5mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Branco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Branco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte: Router') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte: Router', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Impressão UV e adesivado.') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Impressão UV e adesivado.', 40, 20, true);
    END IF;
  END IF;

  -- Placa de MDF
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de MDF' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de MDF', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de MDF' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: 6, 9, 12, 15, 18, 20, 25 e 30mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: 6, 9, 12, 15, 18, 20, 25 e 30mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Cru, Melamínico (1 face e 2 faces), Melamínico CORES (1 face e 2 faces)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Cru, Melamínico (1 face e 2 faces), Melamínico CORES (1 face e 2 faces)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte: Laser, router e manual.') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte: Laser, router e manual.', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Colagem, Impressão, adesivao, pintado, dupla face (Gabarito kraft)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Colagem, Impressão, adesivao, pintado, dupla face (Gabarito kraft)', 40, 20, true);
    END IF;
  END IF;

  -- Placa de papelão
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de papelão' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de papelão', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de papelão' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: Onda C, 3mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: Onda C, 3mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Natural') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Natural', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Impressão UV e adesivado.') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Impressão UV e adesivado.', 40, 20, true);
    END IF;
  END IF;

  -- Placa de Polionda
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de Polionda' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de Polionda', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de Polionda' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: 3 e 4mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: 3 e 4mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Branco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Branco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte: Router') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte: Router', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Dobra e vinco, colagem c/ dupla face, Impressão UV e adesivado.') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Dobra e vinco, colagem c/ dupla face, Impressão UV e adesivado.', 40, 20, true);
    END IF;
  END IF;

  -- Placa de PS (Exemplo 1)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de PS (Exemplo 1)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de PS (Exemplo 1)', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de PS (Exemplo 1)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: 0,3 / 0,5 / 0,8 / 1 / 1,5 / 1,8 / 2 / 3 / 4 / 5mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: 0,3 / 0,5 / 0,8 / 1 / 1,5 / 1,8 / 2 / 3 / 4 / 5mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Branco, cristal (2mm)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Branco, cristal (2mm)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte: Laser, router') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte: Laser, router', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Dobra, pintura fundo, colagem, impressão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Dobra, pintura fundo, colagem, impressão', 40, 20, true);
    END IF;
  END IF;

  -- Placa de PS (Exemplo 2)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de PS (Exemplo 2)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de PS (Exemplo 2)', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de PS (Exemplo 2)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'PP - 0,9mm + Solvente (até 1m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'PP - 0,9mm + Solvente (até 1m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 1mm + Solvente (até 1m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 1mm + Solvente (até 1m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 2mm + Solvente (até 2m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 2mm + Solvente (até 2m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 3mm + Solvente (até 2m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 3mm + Solvente (até 2m²)', 40, 20, true);
    END IF;
  END IF;

  -- Placa de PVC expandido (Exemplo 1)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de PVC expandido (Exemplo 1)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de PVC expandido (Exemplo 1)', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de PVC expandido (Exemplo 1)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Espessuras: 2, 3, 4, 5, 6, 8, 10, 20, 30mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Espessuras: 2, 3, 4, 5, 6, 8, 10, 20, 30mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Cores: Branco') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Cores: Branco', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Corte: Router') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Corte: Router', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Acabamento: Dobra, pintura fundo, colagem, impressão') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Acabamento: Dobra, pintura fundo, colagem, impressão', 40, 20, true);
    END IF;
  END IF;

  -- Placa de PVC expandido (Exemplo 2)
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de PVC expandido (Exemplo 2)' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de PVC expandido (Exemplo 2)', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de PVC expandido (Exemplo 2)' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 2mm_1ª linha: Solvente+Película (até 1,5m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 2mm_1ª linha: Solvente+Película (até 1,5m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 2mm_2ª linha: Solvente (até 1,5m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 2mm_2ª linha: Solvente (até 1,5m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 3mm_1ª linha: Solvente+Película (até 1,5m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 3mm_1ª linha: Solvente+Película (até 1,5m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 3mm_2ª linha: Solvente (até 1,5m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 3mm_2ª linha: Solvente (até 1,5m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 5mm_1ª linha: Solvente+Película (até 3m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 5mm_1ª linha: Solvente+Película (até 3m²)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 5mm_1ª linha: Solvente+Película (até 3m²)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 5mm_1ª linha: Solvente+Película (até 3m²)', 40, 20, true);
    END IF;
  END IF;

  -- Placa de Vidro
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'placas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Placa de Vidro' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Placa de Vidro', 'placas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Placa de Vidro' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '6mm Temperado+Espaçadores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '6mm Temperado+Espaçadores', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '8mm Temperado+Espaçadores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '8mm Temperado+Espaçadores', 40, 20, true);
    END IF;
  END IF;

  -- Porta Cartão de visitas mesa
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Porta Cartão de visitas mesa' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Porta Cartão de visitas mesa', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Porta Cartão de visitas mesa' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Simples Cristal 2mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Simples Cristal 2mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Simples Cores 2mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Simples Cores 2mm', 40, 20, true);
    END IF;
  END IF;

  -- Porta folder/take-one
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Porta folder/take-one' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Porta folder/take-one', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Porta folder/take-one' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - Folder A6 - 10x15x3cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - Folder A6 - 10x15x3cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P Duplo - Folder A6 - 10x15x3cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P Duplo - Folder A6 - 10x15x3cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - Folder - 10x21x3cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - Folder - 10x21x3cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M Duplo- Folder - 10x21x3cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M Duplo- Folder - 10x21x3cm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - Folder A5- 15x21x3cm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - Folder A5- 15x21x3cm', 40, 20, true);
    END IF;
  END IF;

  -- Quadro Canvas
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Quadro Canvas' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Quadro Canvas', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Quadro Canvas' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'MDF/Pinus+Canvas+(Estudar formatos P,M,G)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'MDF/Pinus+Canvas+(Estudar formatos P,M,G)', 40, 20, true);
    END IF;
  END IF;

  -- Quadro madeira placas
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Quadro madeira placas' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Quadro madeira placas', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Quadro madeira placas' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '1ª linha: Cambará 25x50mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '1ª linha: Cambará 25x50mm', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = '2ª linha: Pinus 25x50mm') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, '2ª linha: Pinus 25x50mm', 40, 20, true);
    END IF;
  END IF;

  -- Urna de Acrílico
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Urna de Acrílico' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Urna de Acrílico', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Urna de Acrílico' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 10x10x10cm_Cristal') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 10x10x10cm_Cristal', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - 10x10x10cm_Cores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - 10x10x10cm_Cores', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 20x20x20cm_Cristal') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 20x20x20cm_Cristal', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - 20x20x20cm_Cores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - 20x20x20cm_Cores', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 30x30x30cm_Cristal') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 30x30x30cm_Cristal', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - 30x30x30cm_Cores') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - 30x30x30cm_Cores', 40, 20, true);
    END IF;
  END IF;

  -- Urna de MDF
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Urna de MDF' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Urna de MDF', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Urna de MDF' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'P - Avaliar medidas') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'P - Avaliar medidas', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'M - Avaliar medidas') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'M - Avaliar medidas', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'G - Avaliar medidas') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'G - Avaliar medidas', 40, 20, true);
    END IF;
  END IF;

  -- Wind Banner
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'banners_lonas' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Wind Banner' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Wind Banner', 'banners_lonas', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Wind Banner' LIMIT 1;
  IF v_produto_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Frente (Com costura)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Frente (Com costura)', 40, 20, true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM produto_modelos WHERE produto_id = v_produto_id AND nome = 'Frente e verso (Com costura)') THEN
      INSERT INTO produto_modelos (produto_id, nome, markup_padrao, margem_minima, ativo)
        VALUES (v_produto_id, 'Frente e verso (Com costura)', 40, 20, true);
    END IF;
  END IF;

  -- Woobler
  SELECT id INTO v_cat_id FROM categorias_produto WHERE slug = 'displays' LIMIT 1;
  IF NOT EXISTS (SELECT 1 FROM produtos WHERE nome = 'Woobler' AND ativo = true) THEN
    INSERT INTO produtos (nome, categoria, categoria_id, unidade_padrao, ativo)
      VALUES ('Woobler', 'displays', v_cat_id, 'm2', true);
  END IF;
  SELECT id INTO v_produto_id FROM produtos WHERE nome = 'Woobler' LIMIT 1;

  RAISE NOTICE 'Migration 015 concluída — % produtos do Excel importados', (SELECT COUNT(*) FROM produtos)::text;
END $$;