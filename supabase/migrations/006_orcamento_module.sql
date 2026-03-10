-- ============================================================================
-- 006 — MÓDULO DE ORÇAMENTO AVANÇADO
-- Tabelas para acabamentos, serviços, regras de precificação e templates
-- ============================================================================

-- Acabamentos disponíveis (ilhós, bastão, fundo branco, laminação, etc.)
CREATE TABLE IF NOT EXISTS acabamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  unidade TEXT DEFAULT 'un', -- un, m, m², par
  ativo BOOLEAN DEFAULT TRUE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Serviços adicionais (criação, arte, instalação inclusa, etc.)
CREATE TABLE IF NOT EXISTS servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  custo_hora NUMERIC(12,2) NOT NULL DEFAULT 0,
  horas_estimadas NUMERIC(8,2) DEFAULT 1,
  preco_fixo NUMERIC(12,2), -- se null, usa custo_hora * horas
  categoria TEXT DEFAULT 'outro' CHECK (categoria IN ('criacao', 'instalacao', 'montagem', 'transporte', 'consultoria', 'outro')),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materiais por item de proposta (bridge table)
CREATE TABLE IF NOT EXISTS proposta_item_materiais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_item_id UUID NOT NULL REFERENCES proposta_itens(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materiais(id),
  descricao TEXT NOT NULL, -- nome do material (snapshotted)
  quantidade NUMERIC(10,4) NOT NULL,
  unidade TEXT NOT NULL,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acabamentos por item de proposta
CREATE TABLE IF NOT EXISTS proposta_item_acabamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_item_id UUID NOT NULL REFERENCES proposta_itens(id) ON DELETE CASCADE,
  acabamento_id UUID REFERENCES acabamentos(id),
  descricao TEXT NOT NULL,
  quantidade NUMERIC(10,4) NOT NULL DEFAULT 1,
  custo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Serviços incluídos na proposta
CREATE TABLE IF NOT EXISTS proposta_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  servico_id UUID REFERENCES servicos(id),
  descricao TEXT NOT NULL,
  horas NUMERIC(8,2) DEFAULT 1,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regras de precificação configuráveis (markup por categoria)
CREATE TABLE IF NOT EXISTS regras_precificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria TEXT NOT NULL,          -- 'banner', 'fachada', 'pdv', 'adesivo', 'geral', etc.
  markup_minimo NUMERIC(10,2) NOT NULL DEFAULT 30,
  markup_sugerido NUMERIC(10,2) NOT NULL DEFAULT 50,
  markup_maximo NUMERIC(10,2) DEFAULT 200,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Templates de orçamento (conjunto de itens pré-configurados)
CREATE TABLE IF NOT EXISTS templates_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT,
  itens JSONB NOT NULL DEFAULT '[]', -- array de item specs
  ativo BOOLEAN DEFAULT TRUE,
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ÍNDICES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_acabamentos_ativo ON acabamentos(ativo);
CREATE INDEX IF NOT EXISTS idx_servicos_categoria ON servicos(categoria);
CREATE INDEX IF NOT EXISTS idx_servicos_ativo ON servicos(ativo);
CREATE INDEX IF NOT EXISTS idx_proposta_item_materiais_item ON proposta_item_materiais(proposta_item_id);
CREATE INDEX IF NOT EXISTS idx_proposta_item_acabamentos_item ON proposta_item_acabamentos(proposta_item_id);
CREATE INDEX IF NOT EXISTS idx_proposta_servicos_proposta ON proposta_servicos(proposta_id);
CREATE INDEX IF NOT EXISTS idx_regras_precificacao_categoria ON regras_precificacao(categoria, ativo);
CREATE INDEX IF NOT EXISTS idx_templates_orcamento_ativo ON templates_orcamento(ativo);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE acabamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_item_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_item_acabamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras_precificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates_orcamento ENABLE ROW LEVEL SECURITY;

-- Autenticados podem ver acabamentos e serviços ativos
CREATE POLICY "autenticados_ver_acabamentos" ON acabamentos
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "admin_gerenciar_acabamentos" ON acabamentos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'producao'));

CREATE POLICY "autenticados_ver_servicos" ON servicos
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "admin_gerenciar_servicos" ON servicos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial_senior', 'financeiro'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial_senior', 'financeiro'));

-- Item materiais/acabamentos/servicos: quem pode editar a proposta pode ver/editar
CREATE POLICY "autenticados_ver_proposta_item_materiais" ON proposta_item_materiais
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comercial_editar_proposta_item_materiais" ON proposta_item_materiais
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial', 'comercial_senior'));

CREATE POLICY "autenticados_ver_proposta_item_acabamentos" ON proposta_item_acabamentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comercial_editar_proposta_item_acabamentos" ON proposta_item_acabamentos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial', 'comercial_senior'));

CREATE POLICY "autenticados_ver_proposta_servicos" ON proposta_servicos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comercial_editar_proposta_servicos" ON proposta_servicos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial', 'comercial_senior'));

-- Regras de precificação: admins editam, outros apenas leem
CREATE POLICY "autenticados_ver_regras" ON regras_precificacao
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "admin_gerenciar_regras" ON regras_precificacao
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'financeiro'))
  WITH CHECK (get_user_role() IN ('admin', 'financeiro'));

-- Templates: autenticados veem, comercial/admin editam
CREATE POLICY "autenticados_ver_templates" ON templates_orcamento
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "comercial_gerenciar_templates" ON templates_orcamento
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial', 'comercial_senior'));

-- ─── SEED INICIAL ───────────────────────────────────────────────────────────
INSERT INTO acabamentos (nome, descricao, custo_unitario, unidade, ordem) VALUES
  ('Ilhós a cada 50cm', 'Ilhós de metal cromado a cada 50cm nas bordas', 0.50, 'un', 1),
  ('Ilhós a cada 30cm', 'Ilhós de metal cromado a cada 30cm nas bordas', 0.80, 'un', 2),
  ('Bastão superior e inferior', 'Bastão de PVC com cordinha', 8.00, 'un', 3),
  ('Bainha superior', 'Dobra e costura para bastão', 3.00, 'un', 4),
  ('Fundo branco', 'Impressão com fundo branco para melhor opacidade', 0.15, 'm²', 5),
  ('Laminação brilho', 'Laminação brilhante sobre impressão', 2.50, 'm²', 6),
  ('Laminação fosco', 'Laminação fosca sobre impressão', 2.80, 'm²', 7),
  ('Cantoneiras', 'Cantoneiras plásticas nos quatro cantos', 4.00, 'un', 8),
  ('Velcro adesivo', 'Tiras de velcro para fixação', 1.20, 'par', 9),
  ('Enrolado em tubo', 'Material enrolado em tubo para transporte', 2.00, 'un', 10)
ON CONFLICT DO NOTHING;

INSERT INTO servicos (nome, categoria, custo_hora, horas_estimadas, preco_fixo) VALUES
  ('Criação de Arte', 'criacao', 80.00, 2.0, NULL),
  ('Arte Urgente (24h)', 'criacao', 120.00, 2.0, NULL),
  ('Revisão de Arte', 'criacao', 80.00, 0.5, NULL),
  ('Instalação Local', 'instalacao', 150.00, 3.0, NULL),
  ('Instalação Viagem (por diária)', 'instalacao', 600.00, 8.0, 600.00),
  ('Montagem de Estrutura', 'montagem', 120.00, 4.0, NULL),
  ('Frete Cidade', 'transporte', 0, 0, 80.00),
  ('Frete Estado', 'transporte', 0, 0, 250.00)
ON CONFLICT DO NOTHING;

INSERT INTO regras_precificacao (categoria, markup_minimo, markup_sugerido, markup_maximo, descricao) VALUES
  ('geral', 30, 45, 150, 'Regra padrão para todos os produtos'),
  ('banner', 35, 50, 150, 'Banners e faixas em lona'),
  ('fachada', 40, 60, 200, 'Fachadas ACM e letra-caixa'),
  ('pdv', 35, 55, 180, 'Material de PDV e displays'),
  ('adesivo', 30, 45, 150, 'Adesivos e plotagem'),
  ('envelopamento', 40, 65, 200, 'Envelopamento de veículos e ambientes')
ON CONFLICT DO NOTHING;
