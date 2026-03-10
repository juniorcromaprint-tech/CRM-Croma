-- ============================================================================
-- 010 — SEED MODELO_MATERIAIS E MODELO_PROCESSOS
-- Vincula materiais reais aos modelos de produtos Croma Print
-- Execute APÓS migrations 001 e 009
-- Estratégia: busca materiais por código (MAT-*) e por nome ILIKE
--             Busca modelos via JOIN produtos → produto_modelos por nome ILIKE
--             Seguro para re-execução (ON CONFLICT DO NOTHING)
-- ============================================================================

DO $$
DECLARE
  -- Materiais por código (seeded em 001)
  v_mat_lona_440    UUID;
  v_mat_acm_3mm     UUID;
  v_mat_vinil_adh   UUID;
  v_mat_tinta_sol   UUID;
  v_mat_ilhos       UUID;
  v_mat_metalon     UUID;
  v_mat_led_mod     UUID;
  v_mat_pvc_3mm     UUID;
  v_mat_acr_3mm     UUID;
  v_mat_ferragem    UUID;

  -- Materiais adicionais por nome ILIKE (seeded em 008 / Mubisys)
  v_mat_lona_280    UUID;  -- lona 280g (faixas)
  v_mat_lona_tens   UUID;  -- lona tensionada
  v_mat_bastao_alum UUID;  -- bastão / perfil alumínio
  v_mat_roll_mec    UUID;  -- mecanismo roll-up
  v_mat_lona_sint   UUID;  -- lona sintética / retroprojeção
  v_mat_rebite      UUID;  -- rebite pop
  v_mat_impd        UUID;  -- impressão digital (tinta eco-solvente / aquosa)

BEGIN
  -- ─── Buscar IDs de materiais ──────────────────────────────────────────────

  -- Por código exato (inseridos em 001)
  SELECT id INTO v_mat_lona_440  FROM materiais WHERE codigo = 'MAT-LONA-440'  LIMIT 1;
  SELECT id INTO v_mat_acm_3mm   FROM materiais WHERE codigo = 'MAT-ACM-3MM'   LIMIT 1;
  SELECT id INTO v_mat_vinil_adh FROM materiais WHERE codigo = 'MAT-VIN-ADH'   LIMIT 1;
  SELECT id INTO v_mat_tinta_sol FROM materiais WHERE codigo = 'MAT-TINTA-SOL' LIMIT 1;
  SELECT id INTO v_mat_ilhos     FROM materiais WHERE codigo = 'MAT-ILHOS'     LIMIT 1;
  SELECT id INTO v_mat_metalon   FROM materiais WHERE codigo = 'MAT-METALON'   LIMIT 1;
  SELECT id INTO v_mat_led_mod   FROM materiais WHERE codigo = 'MAT-LED-MOD'   LIMIT 1;
  SELECT id INTO v_mat_pvc_3mm   FROM materiais WHERE codigo = 'MAT-PVC-3MM'   LIMIT 1;
  SELECT id INTO v_mat_acr_3mm   FROM materiais WHERE codigo = 'MAT-ACR-3MM'   LIMIT 1;
  SELECT id INTO v_mat_ferragem  FROM materiais WHERE codigo = 'MAT-FERRAGEM'  LIMIT 1;

  -- Por nome ILIKE (materiais importados do Mubisys via 008)
  -- Lona 280g para faixas
  SELECT id INTO v_mat_lona_280
    FROM materiais
    WHERE nome ILIKE '%lona%280%' AND ativo = true
    LIMIT 1;

  -- Se não encontrou 280g, reutiliza a 440g como fallback
  IF v_mat_lona_280 IS NULL THEN
    v_mat_lona_280 := v_mat_lona_440;
  END IF;

  -- Lona tensionada (backlit, frontlit tensionada)
  SELECT id INTO v_mat_lona_tens
    FROM materiais
    WHERE (nome ILIKE '%tensionada%' OR nome ILIKE '%backlit%' OR nome ILIKE '%frontlit%')
      AND ativo = true
    LIMIT 1;

  -- Bastão / perfil de alumínio (acabamento de lonas)
  SELECT id INTO v_mat_bastao_alum
    FROM materiais
    WHERE (nome ILIKE '%bast%o%' OR nome ILIKE '%perfil%alum%' OR nome ILIKE '%alum%nio%perfil%')
      AND ativo = true
    LIMIT 1;

  -- Mecanismo roll-up
  SELECT id INTO v_mat_roll_mec
    FROM materiais
    WHERE (nome ILIKE '%roll%up%' OR nome ILIKE '%mecanismo%roll%' OR nome ILIKE '%suporte%roll%')
      AND ativo = true
    LIMIT 1;

  -- Lona sintética / retroprojeção / banner sintético
  SELECT id INTO v_mat_lona_sint
    FROM materiais
    WHERE (nome ILIKE '%sint%tic%' OR nome ILIKE '%retroproje%' OR nome ILIKE '%banner%sint%')
      AND ativo = true
    LIMIT 1;

  -- Rebite pop / rebite cego
  SELECT id INTO v_mat_rebite
    FROM materiais
    WHERE (nome ILIKE '%rebite%' OR nome ILIKE '%pop%rebite%')
      AND ativo = true
    LIMIT 1;

  -- Tinta eco-solvente ou aquosa (alternativa à solvente)
  SELECT id INTO v_mat_impd
    FROM materiais
    WHERE (nome ILIKE '%eco%solv%' OR nome ILIKE '%aquos%' OR nome ILIKE '%tinta%digit%')
      AND ativo = true
    LIMIT 1;

  -- Se não encontrou tinta eco, usa a solvente
  IF v_mat_impd IS NULL THEN
    v_mat_impd := v_mat_tinta_sol;
  END IF;

  -- ─── 1. BANNER EM LONA (BAN-LON-001) ─────────────────────────────────────
  -- Material principal: lona 440g/m² (1,05 m² por unidade — inclui sangria 5%)
  -- Material secundário: tinta solvente (consumo médio 1 L por 10 m²)
  -- Material acabamento: ilhós (4 un por banner padrão)
  IF v_mat_lona_440 IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_lona_440, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'BAN-LON-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_tinta_sol IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_tinta_sol, 0.10, 'l'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'BAN-LON-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_ilhos IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_ilhos, 8, 'un'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'BAN-LON-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 2. FACHADA ACM (FAC-ACM-001) ────────────────────────────────────────
  -- ACM 3mm (1,05 m² por m² — inclui corte)
  -- Metalon 30x30 para estrutura (4 m por m²)
  -- Kit ferragem (1 kit por m²)
  IF v_mat_acm_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_acm_3mm, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'FAC-ACM-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_metalon IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_metalon, 4.0, 'm'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'FAC-ACM-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_ferragem IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_ferragem, 1.0, 'kit'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'FAC-ACM-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- Rebite pop para fixação do ACM
  IF v_mat_rebite IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_rebite, 20, 'un'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'FAC-ACM-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 3. ADESIVO DE VITRINE (ADE-VIT-001) ─────────────────────────────────
  -- Vinil adesivo (1,05 m² por m²)
  -- Tinta solvente / eco-solvente
  IF v_mat_vinil_adh IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_vinil_adh, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'ADE-VIT-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_impd IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_impd, 0.10, 'l'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'ADE-VIT-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 4. LETRA CAIXA (LET-CX-001) ─────────────────────────────────────────
  -- ACM 3mm (0,1 m² por letra de 30cm)
  -- ACM acrílico (0,1 m² por letra para modelos com acrílico)
  -- Módulo LED (5 un por letra iluminada)
  -- Kit ferragem (1 kit por letra)
  IF v_mat_acm_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_acm_3mm, 0.12, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'LET-CX-001' AND pm.nome ILIKE '%acm%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_acr_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_acr_3mm, 0.12, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'LET-CX-001' AND pm.nome ILIKE '%acril%'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_led_mod IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_led_mod, 6, 'un'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'LET-CX-001' AND (pm.nome ILIKE '%led%' OR pm.nome ILIKE '%luminoso%')
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_ferragem IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_ferragem, 0.5, 'kit'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'LET-CX-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 5. TOTEM DE SINALIZAÇÃO (TOT-SIN-001) ───────────────────────────────
  -- ACM 3mm para estrutura (1,5 m² por totem interno)
  -- Lona impressa (1,0 m² por face)
  -- Metalon para estrutura interna (3 m)
  -- Kit ferragem
  IF v_mat_acm_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_acm_3mm, 1.5, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'TOT-SIN-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_lona_440 IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_lona_440, 1.0, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'TOT-SIN-001'
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_metalon IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT pm.id, v_mat_metalon, 3.0, 'm'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.codigo = 'TOT-SIN-001'
    ON CONFLICT DO NOTHING;
  END IF;

  -- ─── 6. MODELOS GENÉRICOS POR NOME DO PRODUTO (via 009) ──────────────────
  -- Para produtos importados do Mubisys que não têm código específico,
  -- vinculamos materiais com base no nome da categoria do produto.

  -- Banners genéricos (qualquer produto com "banner" no nome ou categoria "campanhas")
  IF v_mat_lona_440 IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_lona_440, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%banner%' OR p.categoria = 'campanhas')
      AND p.codigo <> 'BAN-LON-001'   -- já tratado acima
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_lona_440
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Faixas (lona 280g — ou 440g como fallback)
  IF v_mat_lona_280 IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_lona_280, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE p.nome ILIKE '%faixa%' AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_lona_280
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Adesivos genéricos (vinil adesivo)
  IF v_mat_vinil_adh IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_vinil_adh, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%adesivo%' OR p.nome ILIKE '%plotagem%' OR p.nome ILIKE '%envelopamento%')
      AND p.codigo <> 'ADE-VIT-001'   -- já tratado acima
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_vinil_adh
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Placas PVC (PVC 3mm)
  IF v_mat_pvc_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_pvc_3mm, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%placa%pvc%' OR p.nome ILIKE '%pvc%placa%' OR p.nome ILIKE '%placa%rigid%')
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_pvc_3mm
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Fachadas genéricas (ACM 3mm)
  IF v_mat_acm_3mm IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_acm_3mm, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%fachada%' OR p.nome ILIKE '%painel%acm%' OR p.categoria = 'fachadas')
      AND p.codigo <> 'FAC-ACM-001'   -- já tratado acima
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_acm_3mm
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Roll-up (lona sintética + mecanismo)
  IF v_mat_lona_sint IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_lona_sint, 1.0, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%roll%up%' OR p.nome ILIKE '%roll-up%' OR p.nome ILIKE '%x.banner%' OR p.nome ILIKE '%x banner%')
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_lona_sint
      )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_mat_roll_mec IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_roll_mec, 1, 'un'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%roll%up%' OR p.nome ILIKE '%roll-up%')
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_roll_mec
      )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Lonas tensionadas (backdrops, tensionadas)
  IF v_mat_lona_tens IS NOT NULL THEN
    INSERT INTO modelo_materiais (modelo_id, material_id, quantidade_por_unidade, unidade)
    SELECT DISTINCT pm.id, v_mat_lona_tens, 1.05, 'm²'
    FROM produto_modelos pm
    JOIN produtos p ON p.id = pm.produto_id
    WHERE (p.nome ILIKE '%tensionada%' OR p.nome ILIKE '%backdrop%' OR p.nome ILIKE '%backlit%')
      AND p.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM modelo_materiais mm
        WHERE mm.modelo_id = pm.id AND mm.material_id = v_mat_lona_tens
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RAISE NOTICE 'modelo_materiais seed concluído.';
  RAISE NOTICE '  v_mat_lona_440=%', v_mat_lona_440;
  RAISE NOTICE '  v_mat_acm_3mm=%',  v_mat_acm_3mm;
  RAISE NOTICE '  v_mat_vinil_adh=%', v_mat_vinil_adh;
  RAISE NOTICE '  v_mat_tinta_sol=%', v_mat_tinta_sol;
  RAISE NOTICE '  v_mat_pvc_3mm=%',  v_mat_pvc_3mm;
  RAISE NOTICE '  v_mat_lona_280=%', v_mat_lona_280;

END $$;


-- ============================================================================
-- SEED MODELO_PROCESSOS
-- Etapas de produção por categoria de modelo
-- ============================================================================

DO $$
BEGIN

  -- ─── Banners e lonas (BAN-LON-001) ────────────────────────────────────────
  -- Etapa 1: Impressão — 5 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Impressão', 5, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'BAN-LON-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Impressão'
    );

  -- Etapa 2: Corte — 2 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Corte', 2, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'BAN-LON-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Corte'
    );

  -- Etapa 3: Acabamento (ilhós, bastão) — 3 min/unidade
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Acabamento', 3, 3
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'BAN-LON-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Acabamento'
    );

  -- ─── Adesivos (ADE-VIT-001) ───────────────────────────────────────────────
  -- Impressão: 5 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Impressão', 5, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'ADE-VIT-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Impressão'
    );

  -- Laminação: 3 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Laminação', 3, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'ADE-VIT-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Laminação'
    );

  -- Corte e recorte: 4 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Corte', 4, 3
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'ADE-VIT-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Corte'
    );

  -- ─── Fachada ACM (FAC-ACM-001) ────────────────────────────────────────────
  -- Corte e dobra ACM: 15 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Corte e Dobra', 15, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'FAC-ACM-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Corte e Dobra'
    );

  -- Impressão (lona com arte): 5 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Impressão', 5, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'FAC-ACM-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Impressão'
    );

  -- Montagem estrutura: 30 min/m²
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Montagem', 30, 3
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'FAC-ACM-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Montagem'
    );

  -- ─── Letra Caixa (LET-CX-001) ─────────────────────────────────────────────
  -- Corte CNC: 20 min/unidade
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Corte CNC', 20, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'LET-CX-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Corte CNC'
    );

  -- Pintura/acabamento: 10 min/unidade
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Pintura', 10, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'LET-CX-001'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Pintura'
    );

  -- Cabeamento LED (apenas letras com LED): 15 min/unidade
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT pm.id, 'Cabeamento LED', 15, 3
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE p.codigo = 'LET-CX-001' AND pm.nome ILIKE '%led%'
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Cabeamento LED'
    );

  -- ─── Banners e adesivos genéricos (por nome do produto) ──────────────────

  -- Impressão para produtos "banner" ou "faixa" genéricos
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT DISTINCT pm.id, 'Impressão', 5, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE (p.nome ILIKE '%banner%' OR p.nome ILIKE '%faixa%' OR p.categoria = 'campanhas')
    AND p.codigo NOT IN ('BAN-LON-001')
    AND p.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Impressão'
    );

  -- Acabamento para banners genéricos
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT DISTINCT pm.id, 'Acabamento', 3, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE (p.nome ILIKE '%banner%' OR p.nome ILIKE '%faixa%' OR p.categoria = 'campanhas')
    AND p.codigo NOT IN ('BAN-LON-001')
    AND p.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Acabamento'
    );

  -- Impressão para adesivos genéricos
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT DISTINCT pm.id, 'Impressão', 5, 1
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE (p.nome ILIKE '%adesivo%' OR p.nome ILIKE '%plotagem%' OR p.nome ILIKE '%envelopamento%')
    AND p.codigo NOT IN ('ADE-VIT-001')
    AND p.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Impressão'
    );

  -- Corte para adesivos genéricos
  INSERT INTO modelo_processos (modelo_id, etapa, tempo_por_unidade_min, ordem)
  SELECT DISTINCT pm.id, 'Corte', 4, 2
  FROM produto_modelos pm
  JOIN produtos p ON p.id = pm.produto_id
  WHERE (p.nome ILIKE '%adesivo%' OR p.nome ILIKE '%plotagem%' OR p.nome ILIKE '%envelopamento%')
    AND p.codigo NOT IN ('ADE-VIT-001')
    AND p.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM modelo_processos mp
      WHERE mp.modelo_id = pm.id AND mp.etapa = 'Corte'
    );

  RAISE NOTICE 'modelo_processos seed concluído.';

END $$;


-- Verificar resultado
SELECT
  (SELECT count(*) FROM modelo_materiais) AS total_modelo_materiais,
  (SELECT count(*) FROM modelo_processos) AS total_modelo_processos,
  (SELECT count(DISTINCT modelo_id) FROM modelo_materiais) AS modelos_com_materiais,
  (SELECT count(DISTINCT modelo_id) FROM modelo_processos) AS modelos_com_processos;
