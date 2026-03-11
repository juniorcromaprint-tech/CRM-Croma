-- =============================================================================
-- Migration 011: Categorias e Produtos Reais da Croma Comunicação Visual
-- =============================================================================
-- Este arquivo cria a tabela de categorias de produto, adiciona colunas
-- necessárias nas tabelas produtos e produto_modelos, e popula o banco com
-- os dados reais de categorias, produtos e modelos utilizados pela empresa.
-- Idempotente: seguro para rodar múltiplas vezes (usa ON CONFLICT e IF NOT EXISTS).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Criar tabela categorias_produto
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR NOT NULL,
  slug VARCHAR UNIQUE NOT NULL,
  descricao TEXT,
  icone VARCHAR DEFAULT 'Package',
  ordem_exibicao INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Adicionar colunas na tabela produtos
-- -----------------------------------------------------------------------------
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_produto(id),
  ADD COLUMN IF NOT EXISTS requer_instalacao BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_checklist_instalacao VARCHAR DEFAULT 'nenhum'
    CHECK (tipo_checklist_instalacao IN ('signmaker','fachada','vidro_acrilico','nenhum'));

-- -----------------------------------------------------------------------------
-- 3. Adicionar colunas na tabela produto_modelos
-- -----------------------------------------------------------------------------
ALTER TABLE produto_modelos
  ADD COLUMN IF NOT EXISTS linha_qualidade VARCHAR DEFAULT 'segunda'
    CHECK (linha_qualidade IN ('primeira','segunda','premium')),
  ADD COLUMN IF NOT EXISTS descritivo_tecnico TEXT,
  ADD COLUMN IF NOT EXISTS descritivo_nf VARCHAR(500),
  ADD COLUMN IF NOT EXISTS garantia_meses INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS garantia_descricao TEXT,
  ADD COLUMN IF NOT EXISTS unidade_venda VARCHAR DEFAULT 'm2'
    CHECK (unidade_venda IN ('m2','unidade','metro_linear','hora','kit')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Unique constraint necessário para ON CONFLICT (produto_id, nome)
CREATE UNIQUE INDEX IF NOT EXISTS idx_produto_modelos_produto_nome
  ON produto_modelos (produto_id, nome);

-- -----------------------------------------------------------------------------
-- 4. Seed das 11 categorias reais
-- -----------------------------------------------------------------------------
INSERT INTO categorias_produto (nome, slug, ordem_exibicao, ativo) VALUES
  ('Adesivos',             'adesivos',       1,  TRUE),
  ('Banners e Lonas',      'banners_lonas',  2,  TRUE),
  ('Placas',               'placas',         3,  TRUE),
  ('Fachadas e Totens',    'fachadas',       4,  TRUE),
  ('Letreiros',            'letreiros',      5,  TRUE),
  ('Luminosos',            'luminosos',      6,  TRUE),
  ('Gráfica',              'grafica',        7,  TRUE),
  ('Estruturas Metálicas', 'estruturas',     8,  TRUE),
  ('Displays e Acrílicos', 'displays',       9,  TRUE),
  ('Iluminação',           'iluminacao',     10, TRUE),
  ('Serviços',             'servicos',       11, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  nome           = EXCLUDED.nome,
  ordem_exibicao = EXCLUDED.ordem_exibicao,
  ativo          = EXCLUDED.ativo;

-- -----------------------------------------------------------------------------
-- 5. Seed dos produtos reais
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  cat_adesivos      UUID;
  cat_banners       UUID;
  cat_placas        UUID;
  cat_fachadas      UUID;
  cat_letreiros     UUID;
  cat_luminosos     UUID;
  cat_grafica       UUID;
  cat_estruturas    UUID;
  cat_displays      UUID;
  cat_iluminacao    UUID;
  cat_servicos      UUID;
BEGIN
  SELECT id INTO cat_adesivos   FROM categorias_produto WHERE slug = 'adesivos';
  SELECT id INTO cat_banners    FROM categorias_produto WHERE slug = 'banners_lonas';
  SELECT id INTO cat_placas     FROM categorias_produto WHERE slug = 'placas';
  SELECT id INTO cat_fachadas   FROM categorias_produto WHERE slug = 'fachadas';
  SELECT id INTO cat_letreiros  FROM categorias_produto WHERE slug = 'letreiros';
  SELECT id INTO cat_luminosos  FROM categorias_produto WHERE slug = 'luminosos';
  SELECT id INTO cat_grafica    FROM categorias_produto WHERE slug = 'grafica';
  SELECT id INTO cat_estruturas FROM categorias_produto WHERE slug = 'estruturas';
  SELECT id INTO cat_displays   FROM categorias_produto WHERE slug = 'displays';
  SELECT id INTO cat_iluminacao FROM categorias_produto WHERE slug = 'iluminacao';
  SELECT id INTO cat_servicos   FROM categorias_produto WHERE slug = 'servicos';

  -- -------------------------
  -- Adesivos
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Jateado', 'adesivos', cat_adesivos, 'ADJ-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Recorte Eletrônico', 'adesivos', cat_adesivos, 'ADRE-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Blackout Impresso', 'adesivos', cat_adesivos, 'ADBL-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Leitoso Impresso', 'adesivos', cat_adesivos, 'ADLT-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Perfurado', 'adesivos', cat_adesivos, 'ADPF-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Adesivo Refletivos', 'adesivos', cat_adesivos, 'ADRF-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Banners e Lonas
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Banner Lona', 'banners_lonas', cat_banners, 'BAN-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Banner Lona e Tecido (m²)', 'banners_lonas', cat_banners, 'BANTM-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Canvas Impresso', 'banners_lonas', cat_banners, 'CAN-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Lona com Ilhós', 'banners_lonas', cat_banners, 'LONIH-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Lona sem Acabamento', 'banners_lonas', cat_banners, 'LONSA-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Faixa', 'banners_lonas', cat_banners, 'FAI-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Wind Banner', 'banners_lonas', cat_banners, 'WBN-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Roll-up', 'banners_lonas', cat_banners, 'RUP-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Placas
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de ACM', 'placas', cat_placas, 'PACM-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de PVC Expandido', 'placas', cat_placas, 'PPVC-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de PS', 'placas', cat_placas, 'PPS-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Acrílico', 'placas', cat_placas, 'PACR-001', 'm2', FALSE, 'vidro_acrilico', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Vidro', 'placas', cat_placas, 'PVID-001', 'm2', FALSE, 'vidro_acrilico', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de MDF', 'placas', cat_placas, 'PMDF-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de FOAM', 'placas', cat_placas, 'PFOM-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Polionda', 'placas', cat_placas, 'PPOL-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Papelão', 'placas', cat_placas, 'PPAP-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Aço Inox', 'placas', cat_placas, 'PINX-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa de Alumínio Natural', 'placas', cat_placas, 'PALN-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa Fotoluminescente', 'placas', cat_placas, 'PFLT-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Placa Refletiva ACM', 'placas', cat_placas, 'PRFL-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Fachadas e Totens
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Revestimento/Fachada em ACM', 'fachadas', cat_fachadas, 'FACM-001', 'm2', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Front Light Parede (Ilhós)', 'fachadas', cat_fachadas, 'FLIH-001', 'm2', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Front Light Parede (Rebite)', 'fachadas', cat_fachadas, 'FLRB-001', 'm2', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Requadro Parede (Ilhós)', 'fachadas', cat_fachadas, 'RQIH-001', 'm2', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Requadro Parede (Rebite)', 'fachadas', cat_fachadas, 'RQRB-001', 'm2', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cavalete Metálico', 'fachadas', cat_fachadas, 'CAV-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Totem ACM', 'fachadas', cat_fachadas, 'TOT-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('TypeTotem', 'fachadas', cat_fachadas, 'TYPT-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Mega Totens', 'fachadas', cat_fachadas, 'MEGT-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Poste Simples Front Light', 'fachadas', cat_fachadas, 'PST-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Luminosos
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Luminoso Caixa 1ª Linha', 'luminosos', cat_luminosos, 'LUM1-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Luminoso Caixa 2ª Linha', 'luminosos', cat_luminosos, 'LUM2-001', 'unidade', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Luminária/Plafon', 'luminosos', cat_luminosos, 'LUMIN-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Letreiros
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letra Caixa Acrílico Luminoso', 'letreiros', cat_letreiros, 'LCAL-001', 'metro_linear', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letra Caixa Galvanizada', 'letreiros', cat_letreiros, 'LCGV-001', 'metro_linear', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letra Caixa INOX 304', 'letreiros', cat_letreiros, 'LCI304-001', 'metro_linear', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letra Caixa INOX 430', 'letreiros', cat_letreiros, 'LCI430-001', 'metro_linear', TRUE, 'fachada', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letreiro de Acrílico Cristal', 'letreiros', cat_letreiros, 'LETAC-001', 'unidade', TRUE, 'vidro_acrilico', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Letreiro de PVC Expandido', 'letreiros', cat_letreiros, 'LETPV-001', 'unidade', TRUE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Gráfica
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cartão de Visitas', 'grafica', cat_grafica, 'CTV-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Panfletos', 'grafica', cat_grafica, 'PNF-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Folder/Cardápio', 'grafica', cat_grafica, 'FLD-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Pastas Personalizadas', 'grafica', cat_grafica, 'PAS-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Crachá PS', 'grafica', cat_grafica, 'CRC-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cartela de Etiqueta', 'grafica', cat_grafica, 'ETQ-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cordão Crachá Liso', 'grafica', cat_grafica, 'CRCLS-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cordão Crachá Silicone', 'grafica', cat_grafica, 'CRCSIL-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Cordão Sublimado Crachá', 'grafica', cat_grafica, 'CRCSUB-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Jacaré Crachá', 'grafica', cat_grafica, 'JCRC-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Estruturas Metálicas
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Galvanizado', 'estruturas', cat_estruturas, 'QGVN-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Galvanizado c/ Mecânica', 'estruturas', cat_estruturas, 'QGVM-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Alumínio', 'estruturas', cat_estruturas, 'QALN-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Madeira Placas', 'estruturas', cat_estruturas, 'QMAD-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Canvas', 'estruturas', cat_estruturas, 'QCVS-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Quadro Smart-Frame', 'estruturas', cat_estruturas, 'QSMF-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Suporte Sustentação Galvanizado', 'estruturas', cat_estruturas, 'SUPG-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Sapatas Sustentação', 'estruturas', cat_estruturas, 'SAP-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Displays e Acrílicos
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Bolsa PETG/Acrílico/PS', 'displays', cat_displays, 'DISP-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Porta Folder/Take-One', 'displays', cat_displays, 'PF-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Porta Cartão de Visitas Mesa', 'displays', cat_displays, 'PCVM-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Porta Sachê', 'displays', cat_displays, 'PSC-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Urna de Acrílico', 'displays', cat_displays, 'URNA-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Urna de MDF', 'displays', cat_displays, 'URMD-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Chaveiro Acrílico', 'displays', cat_displays, 'CHAV-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Woobler', 'displays', cat_displays, 'WOB-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Mobile Impresso', 'displays', cat_displays, 'MOB-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Mobile Papel', 'displays', cat_displays, 'MOBP-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Moldura em ACM', 'displays', cat_displays, 'MOLACM-001', 'unidade', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Painel de Gestão à Vista', 'displays', cat_displays, 'PGV-001', 'm2', FALSE, 'vidro_acrilico', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Ambientação', 'displays', cat_displays, 'AMB-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Imantado 0,4mm', 'displays', cat_displays, 'IMAN04-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Imantado 0,8mm', 'displays', cat_displays, 'IMAN08-001', 'm2', FALSE, 'signmaker', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Iluminação
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('KIT Refletor LED', 'iluminacao', cat_iluminacao, 'KLED-001', 'kit', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  -- -------------------------
  -- Serviços
  -- -------------------------
  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Criação e Arte Final', 'servicos', cat_servicos, 'ART-001', 'hora', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Corte em CNC (m²)', 'servicos', cat_servicos, 'CNC-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Corte em Laser (m²)', 'servicos', cat_servicos, 'LASER-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Corte em Router (m²)', 'servicos', cat_servicos, 'ROUT-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

  INSERT INTO produtos (nome, categoria, categoria_id, codigo, unidade_padrao, requer_instalacao, tipo_checklist_instalacao, ativo)
  VALUES ('Corte em Router', 'servicos', cat_servicos, 'ROUTM-001', 'm2', FALSE, 'nenhum', TRUE)
  ON CONFLICT (codigo) DO UPDATE SET
    categoria_id = EXCLUDED.categoria_id,
    requer_instalacao = EXCLUDED.requer_instalacao,
    tipo_checklist_instalacao = EXCLUDED.tipo_checklist_instalacao;

END $$;

-- -----------------------------------------------------------------------------
-- 6. Seed dos modelos principais por produto
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  pid_ban          UUID;
  pid_fai          UUID;
  pid_adre         UUID;
  pid_pacm         UUID;
  pid_ppvc         UUID;
  pid_facm         UUID;
  pid_ctv          UUID;
  pid_letac        UUID;
  pid_lcgv         UUID;
  pid_lum1         UUID;
  pid_urna         UUID;
  pid_kled         UUID;
  pid_lonih        UUID;
  pid_cav          UUID;
  pid_disp         UUID;
  pid_iman04       UUID;
  pid_tot          UUID;
  pid_rout         UUID;
  pid_routm        UUID;
  pid_art          UUID;
BEGIN
  SELECT id INTO pid_ban    FROM produtos WHERE codigo = 'BAN-001';
  SELECT id INTO pid_fai    FROM produtos WHERE codigo = 'FAI-001';
  SELECT id INTO pid_adre   FROM produtos WHERE codigo = 'ADRE-001';
  SELECT id INTO pid_pacm   FROM produtos WHERE codigo = 'PACM-001';
  SELECT id INTO pid_ppvc   FROM produtos WHERE codigo = 'PPVC-001';
  SELECT id INTO pid_facm   FROM produtos WHERE codigo = 'FACM-001';
  SELECT id INTO pid_ctv    FROM produtos WHERE codigo = 'CTV-001';
  SELECT id INTO pid_letac  FROM produtos WHERE codigo = 'LETAC-001';
  SELECT id INTO pid_lcgv   FROM produtos WHERE codigo = 'LCGV-001';
  SELECT id INTO pid_lum1   FROM produtos WHERE codigo = 'LUM1-001';
  SELECT id INTO pid_urna   FROM produtos WHERE codigo = 'URNA-001';
  SELECT id INTO pid_kled   FROM produtos WHERE codigo = 'KLED-001';
  SELECT id INTO pid_lonih  FROM produtos WHERE codigo = 'LONIH-001';
  SELECT id INTO pid_cav    FROM produtos WHERE codigo = 'CAV-001';
  SELECT id INTO pid_disp   FROM produtos WHERE codigo = 'DISP-001';
  SELECT id INTO pid_iman04 FROM produtos WHERE codigo = 'IMAN04-001';
  SELECT id INTO pid_tot    FROM produtos WHERE codigo = 'TOT-001';
  SELECT id INTO pid_rout   FROM produtos WHERE codigo = 'ROUT-001';
  SELECT id INTO pid_routm  FROM produtos WHERE codigo = 'ROUTM-001';
  SELECT id INTO pid_art    FROM produtos WHERE codigo = 'ART-001';

  -- -----------------------------------------------
  -- Banner Lona
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_ban, '40x60cm',           45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '80x60cm',           45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '60x100cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '80x100cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '80x120cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '100x120cm',         45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '100x150cm',         45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '100x200cm',         45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, '120x200cm',         45, 6, 'segunda', 'm2', TRUE),
    (pid_ban, 'Por m²_Personalizado', 45, 6, 'segunda', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Faixa
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_fai, 'P-200x60cm',           45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'P-200x100cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'M-300x80cm',           45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'M-300x120cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'G-400x80cm',           45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'G-400x120cm',          45, 6, 'segunda', 'm2', TRUE),
    (pid_fai, 'Por m²_Personalizado', 45, 6, 'segunda', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Adesivo Recorte Eletrônico
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_adre, '1ª linha: Oracal/Similar_1cor',      55, 24, 'primeira', 'm2', TRUE),
    (pid_adre, '1ª linha: Oracal/Similar_2cores',     55, 24, 'primeira', 'm2', TRUE),
    (pid_adre, '2ª linha: Color_Goldmax_1cor',        40,  6, 'segunda', 'm2', TRUE),
    (pid_adre, '2ª linha: Color_Goldmax_2cores',      40,  6, 'segunda', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Placa de ACM
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_pacm, 'Premium: RE Oracal + Película',              65, 36, 'premium', 'm2', TRUE),
    (pid_pacm, '1ª linha: Adesivo Solvente + Película',      55, 18, 'primeira',      'm2', TRUE),
    (pid_pacm, '2ª linha: Adesivo Solvente',                 40,  6, 'segunda',      'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Placa de PVC Expandido
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_ppvc, 'P - 2mm_1ª linha: Solvente+Película (até 1,5m²)', 50, 18, 'primeira', 'm2', TRUE),
    (pid_ppvc, 'P - 2mm_2ª linha: Solvente (até 1,5m²)',          40,  6, 'segunda', 'm2', TRUE),
    (pid_ppvc, 'M - 3mm_1ª linha: Solvente+Película (até 1,5m²)', 50, 18, 'primeira', 'm2', TRUE),
    (pid_ppvc, 'M - 3mm_2ª linha: Solvente (até 1,5m²)',          40,  6, 'segunda', 'm2', TRUE),
    (pid_ppvc, 'G - 5mm_1ª linha: Solvente+Película (até 3m²)',   50, 18, 'primeira', 'm2', TRUE),
    (pid_ppvc, 'G - 5mm_2ª linha: Solvente (até 3m²)',            40,  6, 'segunda', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Revestimento/Fachada em ACM
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_facm, 'Estrutura 20x20 + ACM 3mm Poliéster', 60, 24, 'primeira',     'm2', TRUE),
    (pid_facm, 'Estrutura 30x30 + ACM 3mm Poliéster', 60, 24, 'primeira',     'm2', TRUE),
    (pid_facm, 'Estrutura 30x30 + ACM 4mm Kynar',     70, 36, 'premium', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Cartão de Visitas
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_ctv, '1ª linha: 300g+Lam.Fosca+Verniz loc.+4x4',  45, 0, 'primeira',     'unidade', TRUE),
    (pid_ctv, '2ª linha: 300g+Verniz+4x4',                 35, 0, 'segunda',      'unidade', TRUE),
    (pid_ctv, 'Premium: 300g+Lam.Fosca+hot Stamping+4x4',  60, 0, 'premium', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Letreiro de Acrílico Cristal
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_letac, '10mm + Adesivo Faceado', 60, 24, 'primeira', 'unidade', TRUE),
    (pid_letac, '10mm + Adesivo Verso',   60, 24, 'primeira', 'unidade', TRUE),
    (pid_letac, '10mm + Pintura',         65, 24, 'primeira', 'unidade', TRUE),
    (pid_letac, '10mm + Impressão',       60, 24, 'primeira', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Letra Caixa Galvanizada
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_lcgv, 'Sem iluminação',                       65, 18, 'primeira',     'metro_linear', TRUE),
    (pid_lcgv, 'Face com Acrílico branco e LED',       70, 18, 'primeira',     'metro_linear', TRUE),
    (pid_lcgv, 'Face com Acrílico impresso e LED',     70, 18, 'primeira',     'metro_linear', TRUE),
    (pid_lcgv, 'Retroiluminado',                       75, 18, 'premium', 'metro_linear', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Luminoso Caixa 1ª Linha
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_lum1, 'P - 100x60cm_4x4',     65, 18, 'primeira', 'unidade', TRUE),
    (pid_lum1, 'M - 120x80cm_4x4',     65, 18, 'primeira', 'unidade', TRUE),
    (pid_lum1, 'G - 150x100cm_4x4',    65, 18, 'primeira', 'unidade', TRUE),
    (pid_lum1, 'Por m²_Personalizado', 65, 18, 'primeira', 'm2',      TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Urna de Acrílico
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_urna, 'P - 10x10x10cm_Cristal', 60, 12, 'primeira', 'unidade', TRUE),
    (pid_urna, 'P - 10x10x10cm_Cores',   60, 12, 'primeira', 'unidade', TRUE),
    (pid_urna, 'M - 20x20x20cm_Cristal', 60, 12, 'primeira', 'unidade', TRUE),
    (pid_urna, 'M - 20x20x20cm_Cores',   60, 12, 'primeira', 'unidade', TRUE),
    (pid_urna, 'G - 30x30x30cm_Cristal', 60, 12, 'primeira', 'unidade', TRUE),
    (pid_urna, 'G - 30x30x30cm_Cores',   60, 12, 'primeira', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- KIT Refletor LED
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_kled, '10W 6500k + Suporte + Fiação (1,2x1,2m)', 50, 12, 'primeira', 'kit', TRUE),
    (pid_kled, '30W 6500k + Suporte + Fiação (1,5x1,5m)', 50, 12, 'primeira', 'kit', TRUE),
    (pid_kled, '50W 6500k + Suporte + Fiação (2x2m)',     50, 12, 'primeira', 'kit', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Lona com Ilhós
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_lonih, 'Front 380g Fosca + Ilhós Latão',   45, 24, 'primeira', 'm2', TRUE),
    (pid_lonih, 'Front 380g Brilho + Ilhós Latão',  45, 24, 'primeira', 'm2', TRUE),
    (pid_lonih, 'Front 440g Fosca + Ilhós Latão',   40,  6, 'segunda', 'm2', TRUE),
    (pid_lonih, 'Front 440g Brilho + Ilhós Latão',  40,  6, 'segunda', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Cavalete Metálico
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_cav, 'P - 60x80cm_1 face',    55, 12, 'primeira', 'unidade', TRUE),
    (pid_cav, 'P - 60x80cm_2 faces',   60, 12, 'primeira', 'unidade', TRUE),
    (pid_cav, 'M - 80x120cm_1 face',   55, 12, 'primeira', 'unidade', TRUE),
    (pid_cav, 'M - 80x120cm_2 faces',  60, 12, 'primeira', 'unidade', TRUE),
    (pid_cav, 'G - 100x150cm_1 face',  55, 12, 'primeira', 'unidade', TRUE),
    (pid_cav, 'G - 100x150cm_2 faces', 60, 12, 'primeira', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Bolsa PETG/Acrílico/PS
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_disp, 'A3 parede (42x30cm)',       55, 12, 'primeira', 'unidade', TRUE),
    (pid_disp, 'A4 parede (30x21cm)',       55, 12, 'primeira', 'unidade', TRUE),
    (pid_disp, 'A5 parede (21x15cm)',       55, 12, 'primeira', 'unidade', TRUE),
    (pid_disp, 'A6 parede Simples (15x10cm)', 55, 12, 'primeira', 'unidade', TRUE),
    (pid_disp, 'Projeto Personalizado',     55, 12, 'primeira', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Imantado 0,4mm
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_iman04, 'Adesivo impresso fosco',                45,  6, 'segunda', 'm2', TRUE),
    (pid_iman04, 'Adesivo impresso brilho',               45,  6, 'segunda', 'm2', TRUE),
    (pid_iman04, 'Adesivo impresso + Laminação fosco',    50, 18, 'primeira', 'm2', TRUE),
    (pid_iman04, 'Adesivo impresso + Laminação brilho',   50, 18, 'primeira', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Totem ACM
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_tot, 'Projeto personalizado_Front Light', 70, 18, 'primeira', 'unidade', TRUE),
    (pid_tot, 'Projeto personalizado_Back Light',  70, 18, 'primeira', 'unidade', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Corte em Router (m²) — ROUT-001
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_rout, 'Área quadrada 3 a 5mm', 50, 0, 'primeira', 'm2', TRUE),
    (pid_rout, 'Área quadrada 10mm',    50, 0, 'primeira', 'm2', TRUE),
    (pid_rout, 'Área quadrada 20mm',    50, 0, 'primeira', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- Corte em Router — ROUTM-001 (mesmos modelos)
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_routm, 'Área quadrada 3 a 5mm', 50, 0, 'primeira', 'm2', TRUE),
    (pid_routm, 'Área quadrada 10mm',    50, 0, 'primeira', 'm2', TRUE),
    (pid_routm, 'Área quadrada 20mm',    50, 0, 'primeira', 'm2', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

  -- -----------------------------------------------
  -- Criação e Arte Final
  -- -----------------------------------------------
  INSERT INTO produto_modelos (produto_id, nome, markup_padrao, garantia_meses, linha_qualidade, unidade_venda, ativo)
  VALUES
    (pid_art, 'Hora homem', 60, 0, 'primeira', 'hora', TRUE)
  ON CONFLICT (produto_id, nome) DO UPDATE SET
    markup_padrao   = EXCLUDED.markup_padrao,
    garantia_meses  = EXCLUDED.garantia_meses,
    linha_qualidade = EXCLUDED.linha_qualidade,
    unidade_venda   = EXCLUDED.unidade_venda;

END $$;
