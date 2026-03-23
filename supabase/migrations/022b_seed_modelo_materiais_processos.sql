-- ============================================================
-- Migration 022: Seed modelo_materiais e modelo_processos
-- Vincula materiais reais aos 156 modelos de produto por categoria
-- e cria processos padrão por tipo de produto.
-- Motor Mubisys passa a receber arrays populados => orçamento com preço real.
--
-- Schema real verificado em 2026-03-13:
--   modelo_materiais: id, modelo_id, material_id, quantidade_por_unidade, unidade, created_at
--   modelo_processos: id, modelo_id, etapa, tempo_por_unidade_min, ordem, created_at, centro_custo_id, tipo_processo
-- ============================================================

DO $$
DECLARE
  -- -------------------------------------------------------
  -- IDs de materiais
  -- -------------------------------------------------------

  -- LONAS
  v_lona_front_440g_fosca   uuid;
  v_lona_backlight_440g     uuid;
  v_lona_bo_440g            uuid;

  -- ILHÓS
  v_ilhos_latao             uuid;

  -- REFORÇO LONA
  v_reforco_lona            uuid;

  -- VINIL
  v_vinil_branco_brilho     uuid;
  v_vinil_blockout_fosco    uuid;
  v_vinil_lam_brilho        uuid;
  v_vinil_lam_fosca         uuid;

  -- ACM / CHAPA
  v_acm_3mm                 uuid;
  v_pvc_expand_5mm          uuid;
  v_pvc_expand_3mm          uuid;

  -- LED / ELETRÔNICO
  v_led_modulo              uuid;
  v_fonte_led_10a           uuid;

  -- PAPEL / GRÁFICA
  v_papel_couche_250g       uuid;

  -- FIXAÇÃO
  v_parafuso_gesso          uuid;
  v_parafuso_marcenaria     uuid;
  v_rebite_pop              uuid;

  -- ROLL UP
  v_rollup_100              uuid;

  -- Cursor
  rec RECORD;
  v_ordem integer;

BEGIN

  -- ============================================================
  -- PASSO 1: Buscar IDs dos materiais por nome ILIKE
  -- ============================================================

  SELECT id INTO v_lona_front_440g_fosca  FROM materiais WHERE nome ILIKE '%Lona Frontlight Fosca 440g%' LIMIT 1;
  SELECT id INTO v_lona_backlight_440g    FROM materiais WHERE nome ILIKE '%Lona Backlight 440g%' AND nome NOT ILIKE '%5m%' LIMIT 1;
  SELECT id INTO v_lona_bo_440g           FROM materiais WHERE nome ILIKE '%Lona BO 440g%' LIMIT 1;

  SELECT id INTO v_ilhos_latao            FROM materiais WHERE nome ILIKE '%Ilhos Latao%' LIMIT 1;
  SELECT id INTO v_reforco_lona           FROM materiais WHERE nome ILIKE '%Reforco lona%' AND nome NOT ILIKE '%StarTape%' LIMIT 1;

  SELECT id INTO v_vinil_branco_brilho    FROM materiais WHERE nome ILIKE '%Vinil Branco Brilho Promo%' LIMIT 1;
  SELECT id INTO v_vinil_blockout_fosco   FROM materiais WHERE nome ILIKE '%Vinil Blockout Fosco%' LIMIT 1;
  SELECT id INTO v_vinil_lam_brilho       FROM materiais WHERE nome ILIKE '%Vinil Laminacao Brilho%' LIMIT 1;
  SELECT id INTO v_vinil_lam_fosca        FROM materiais WHERE nome ILIKE '%Vinil Laminacao Fosca%' LIMIT 1;

  SELECT id INTO v_acm_3mm               FROM materiais WHERE nome ILIKE '%Chapa ACM 3mm%' AND nome NOT ILIKE '%Colorido%' LIMIT 1;
  SELECT id INTO v_pvc_expand_5mm        FROM materiais WHERE nome ILIKE '%Chapa PVC Expand. Branco 5mm%' LIMIT 1;
  SELECT id INTO v_pvc_expand_3mm        FROM materiais WHERE nome ILIKE '%Chapa PVC Expand. Branco 3mm%' LIMIT 1;

  SELECT id INTO v_led_modulo            FROM materiais WHERE nome ILIKE '%LED Modulos%' LIMIT 1;
  SELECT id INTO v_fonte_led_10a         FROM materiais WHERE nome ILIKE '%Fonte para LED%10A%' LIMIT 1;

  SELECT id INTO v_papel_couche_250g     FROM materiais WHERE nome ILIKE '%Papel Couche 250g%' LIMIT 1;

  SELECT id INTO v_parafuso_gesso        FROM materiais WHERE nome ILIKE '%Parafuso e bucha%gesso%' LIMIT 1;
  SELECT id INTO v_parafuso_marcenaria   FROM materiais WHERE nome ILIKE '%Parafuso e bucha%marcenaria%' LIMIT 1;
  SELECT id INTO v_rebite_pop            FROM materiais WHERE nome ILIKE '%Rebite pop%' LIMIT 1;

  SELECT id INTO v_rollup_100            FROM materiais WHERE nome ILIKE '%Roll Up 1,00%' LIMIT 1;

  -- ============================================================
  -- PASSO 2: BANNERS_LONAS
  -- Lona frontlight 440g fosca + ilhós latão + reforço lona
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'banners_lonas'
  LOOP
    IF v_lona_front_440g_fosca IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_lona_front_440g_fosca, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_lona_front_440g_fosca);
    END IF;

    IF v_ilhos_latao IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_ilhos_latao, 8, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_ilhos_latao);
    END IF;

    IF v_reforco_lona IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_reforco_lona, 1.5, 'm'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_reforco_lona);
    END IF;

    -- Processos
    v_ordem := 1;
    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão Digital', 15, v_ordem, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão Digital');

    v_ordem := 2;
    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Acabamento/Ilhós', 10, v_ordem, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Acabamento/Ilhós');

    v_ordem := 3;
    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Embalagem', 5, v_ordem, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Embalagem');
  END LOOP;

  -- ============================================================
  -- PASSO 3: ADESIVOS
  -- Vinil branco brilho + laminação brilho
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'adesivos'
  LOOP
    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    IF v_vinil_lam_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_lam_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_lam_brilho);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão', 12, 1, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Laminação', 8, 2, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Laminação');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Recorte', 10, 3, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Recorte');
  END LOOP;

  -- ============================================================
  -- PASSO 4: FACHADAS
  -- ACM 3mm + vinil impresso + rebite + parafuso
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'fachadas'
  LOOP
    IF v_acm_3mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_acm_3mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_acm_3mm);
    END IF;

    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    IF v_rebite_pop IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_rebite_pop, 20, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_rebite_pop);
    END IF;

    IF v_parafuso_gesso IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_parafuso_gesso, 8, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_parafuso_gesso);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte CNC', 20, 1, 'corte_cnc'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte CNC');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Dobra', 15, 2, 'serralheria'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Dobra');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Montagem', 30, 3, 'instalacao'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Montagem');
  END LOOP;

  -- ============================================================
  -- PASSO 5: DISPLAYS
  -- PVC 5mm + vinil blockout + parafuso
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'displays'
  LOOP
    IF v_pvc_expand_5mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_pvc_expand_5mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_pvc_expand_5mm);
    END IF;

    IF v_vinil_blockout_fosco IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_blockout_fosco, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_blockout_fosco);
    END IF;

    IF v_parafuso_marcenaria IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_parafuso_marcenaria, 6, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_parafuso_marcenaria);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte', 15, 1, 'corte_router'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Montagem', 20, 2, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Montagem');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Embalagem', 5, 3, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Embalagem');
  END LOOP;

  -- ============================================================
  -- PASSO 6: ESTRUTURAS (Roll Up)
  -- Estrutura roll up + lona backlight
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'estruturas'
       OR LOWER(p.nome) ILIKE '%roll%up%'
  LOOP
    IF v_rollup_100 IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_rollup_100, 1, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_rollup_100);
    END IF;

    IF v_lona_backlight_440g IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_lona_backlight_440g, 2.2, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_lona_backlight_440g);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão', 15, 1, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Montagem Estrutura', 10, 2, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Montagem Estrutura');
  END LOOP;

  -- ============================================================
  -- PASSO 7: LETREIROS / LUMINOSOS / ILUMINACAO
  -- ACM 3mm + LED módulos + fonte LED + PVC 3mm
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) IN ('letreiros', 'luminosos', 'iluminacao')
  LOOP
    IF v_acm_3mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_acm_3mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_acm_3mm);
    END IF;

    IF v_led_modulo IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_led_modulo, 10, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_led_modulo);
    END IF;

    IF v_fonte_led_10a IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_fonte_led_10a, 1, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_fonte_led_10a);
    END IF;

    IF v_pvc_expand_3mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_pvc_expand_3mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_pvc_expand_3mm);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte CNC', 20, 1, 'corte_cnc'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte CNC');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Instalação LED', 30, 2, 'montagem'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Instalação LED');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Montagem', 25, 3, 'instalacao'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Montagem');
  END LOOP;

  -- ============================================================
  -- PASSO 8: PLACAS
  -- PVC 3mm + vinil impresso + parafuso
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'placas'
  LOOP
    IF v_pvc_expand_3mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_pvc_expand_3mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_pvc_expand_3mm);
    END IF;

    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    IF v_parafuso_marcenaria IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_parafuso_marcenaria, 4, 'un'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_parafuso_marcenaria);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão', 10, 1, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte', 8, 2, 'corte_router'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Aplicação Vinil', 10, 3, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Aplicação Vinil');
  END LOOP;

  -- ============================================================
  -- PASSO 9: GRÁFICA
  -- Papel couché 250g + laminação brilho
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'grafica'
  LOOP
    IF v_papel_couche_250g IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_papel_couche_250g, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_papel_couche_250g);
    END IF;

    IF v_vinil_lam_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_lam_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_lam_brilho);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão', 5, 1, 'impressao_offset'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte', 3, 2, 'corte_router'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Dobra', 3, 3, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Dobra');
  END LOOP;

  -- ============================================================
  -- PASSO 10: COMUNICAÇÃO VISUAL (categoria genérica — 142 produtos)
  -- Vinil branco brilho + laminação fosca
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.categoria = 'Comunicação Visual'
  LOOP
    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    IF v_vinil_lam_fosca IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_lam_fosca, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_lam_fosca);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão Digital', 12, 1, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão Digital');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Corte/Acabamento', 8, 2, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Corte/Acabamento');
  END LOOP;

  -- ============================================================
  -- PASSO 11: PLACAS E DISPLAYS (categoria mista — 10 produtos)
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.categoria = 'Placas e Displays'
  LOOP
    IF v_pvc_expand_5mm IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_pvc_expand_5mm, 1.05, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_pvc_expand_5mm);
    END IF;

    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Impressão', 12, 1, 'impressao_solvente'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Impressão');

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Montagem', 15, 2, 'acabamento'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Montagem');
  END LOOP;

  -- ============================================================
  -- PASSO 12: SERVIÇOS (apenas processos, sem materiais físicos)
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'servicos'
  LOOP
    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Execução', 60, 1, 'montagem'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Execução');
  END LOOP;

  -- ============================================================
  -- PASSO 13: OUTROS
  -- ============================================================

  FOR rec IN
    SELECT pm.id AS modelo_id
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE LOWER(p.categoria) = 'outros'
  LOOP
    IF v_vinil_branco_brilho IS NOT NULL THEN
      INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
      SELECT rec.modelo_id, v_vinil_branco_brilho, 1.1, 'm²'
      WHERE NOT EXISTS (SELECT 1 FROM modelo_materiais WHERE modelo_id = rec.modelo_id AND material_id = v_vinil_branco_brilho);
    END IF;

    INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem, tipo_processo)
    SELECT rec.modelo_id, 'Produção', 15, 1, 'montagem'
    WHERE NOT EXISTS (SELECT 1 FROM modelo_processos WHERE modelo_id = rec.modelo_id AND etapa = 'Produção');
  END LOOP;

  RAISE NOTICE 'Migration 022 concluída: modelo_materiais e modelo_processos populados.';

END $$;
