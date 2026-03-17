-- 059_pcp_setores_templates.sql
-- Setores de produção e templates configuráveis de etapas por categoria

-- Tabela de setores de produção (configurável pelo admin)
CREATE TABLE IF NOT EXISTS setores_producao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  codigo TEXT NOT NULL UNIQUE,
  cor TEXT DEFAULT '#3B82F6',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  capacidade_diaria_min INTEGER DEFAULT 480,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE setores_producao IS 'Setores de produção configuráveis (criação, impressão, etc.)';

-- Template de etapas por categoria de produto
CREATE TABLE IF NOT EXISTS etapa_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria_id UUID REFERENCES categorias_produto(id) ON DELETE SET NULL,
  setor_id UUID NOT NULL REFERENCES setores_producao(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  ordem INTEGER DEFAULT 0,
  tempo_estimado_min INTEGER DEFAULT 60,
  obrigatoria BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE etapa_templates IS 'Templates de etapas por categoria de produto e setor';

-- Seed: setores padrão da Croma Print
INSERT INTO setores_producao (nome, codigo, cor, ordem, capacidade_diaria_min) VALUES
  ('Criação / Arte', 'criacao', '#8B5CF6', 0, 480),
  ('Impressão', 'impressao', '#3B82F6', 1, 600),
  ('Router / Corte', 'router', '#F59E0B', 2, 480),
  ('Acabamento', 'acabamento', '#10B981', 3, 480),
  ('Serralheria', 'serralheria', '#6B7280', 4, 480),
  ('Expedição', 'expedicao', '#EC4899', 5, 240)
ON CONFLICT (codigo) DO NOTHING;

-- Adicionar setor_id em producao_etapas (nullable para retrocompatibilidade)
ALTER TABLE producao_etapas
  ADD COLUMN IF NOT EXISTS setor_id UUID REFERENCES setores_producao(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES etapa_templates(id) ON DELETE SET NULL;

-- Trigger: updated_at em setores_producao
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_setores_updated_at ON setores_producao;

CREATE TRIGGER tr_setores_updated_at
  BEFORE UPDATE ON setores_producao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_etapa_templates_setor ON etapa_templates(setor_id);
CREATE INDEX IF NOT EXISTS idx_etapa_templates_categoria ON etapa_templates(categoria_id);
CREATE INDEX IF NOT EXISTS idx_producao_etapas_setor ON producao_etapas(setor_id);
