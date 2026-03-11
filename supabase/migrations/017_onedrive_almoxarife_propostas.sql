-- 017: OneDrive fields, Almoxarife tables, Propostas table, Feature flags

-- 1. OneDrive fields on pedidos
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS onedrive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS onedrive_folder_url TEXT;

-- 2. Ferramentas (almoxarife)
CREATE TABLE IF NOT EXISTS ferramentas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT,
  categoria TEXT DEFAULT 'ferramenta' CHECK (categoria IN ('ferramenta','veiculo','equipamento')),
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Checkout almoxarife
CREATE TABLE IF NOT EXISTS checkout_almoxarife (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES ferramentas(id),
  pedido_id UUID REFERENCES pedidos(id),
  usuario_id UUID REFERENCES profiles(id),
  retirado_em TIMESTAMPTZ DEFAULT NOW(),
  devolvido_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Diário de bordo (equipamentos)
CREATE TABLE IF NOT EXISTS diario_bordo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ferramenta_id UUID NOT NULL REFERENCES ferramentas(id),
  tipo TEXT DEFAULT 'preventiva' CHECK (tipo IN ('preventiva','corretiva','inspecao')),
  descricao TEXT NOT NULL,
  realizado_por UUID REFERENCES profiles(id),
  realizado_em TIMESTAMPTZ DEFAULT NOW(),
  proximo_em TIMESTAMPTZ,
  custo NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Propostas (pipeline comercial)
-- NOTE: propostas table already exists (created in 001_complete_schema.sql).
-- Add new columns needed for CRM pipeline features.
CREATE TABLE IF NOT EXISTS propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT,
  titulo TEXT NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  vendedor_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','em_negociacao','aprovada','recusada','expirada')),
  valor_estimado NUMERIC(14,2) DEFAULT 0,
  probabilidade INTEGER DEFAULT 50 CHECK (probabilidade BETWEEN 0 AND 100),
  validade_dias INTEGER DEFAULT 30,
  descricao TEXT,
  observacoes TEXT,
  excluido_em TIMESTAMPTZ,
  excluido_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns to existing propostas table (IF NOT EXISTS guards are safe)
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS valor_estimado NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS probabilidade INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS excluido_por UUID REFERENCES profiles(id);

-- Auto-número propostas
CREATE SEQUENCE IF NOT EXISTS propostas_numero_seq START 1;
CREATE OR REPLACE FUNCTION set_proposta_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    NEW.numero := 'PROP-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('propostas_numero_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_proposta_numero ON propostas;
CREATE TRIGGER trg_proposta_numero BEFORE INSERT ON propostas FOR EACH ROW EXECUTE FUNCTION set_proposta_numero();

-- 6. Campanhas comerciais
CREATE TABLE IF NOT EXISTS campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  origem TEXT DEFAULT 'email' CHECK (origem IN ('email','redes_sociais','indicacao','prospeccao','evento','outro')),
  status TEXT DEFAULT 'ativa' CHECK (status IN ('rascunho','ativa','pausada','concluida')),
  data_inicio DATE,
  data_fim DATE,
  orcamento NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link leads -> campanhas
ALTER TABLE leads ADD COLUMN IF NOT EXISTS campanha_id UUID REFERENCES campanhas(id);

-- 7. admin_config feature flags
-- Create table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO admin_config (chave, valor, descricao)
SELECT chave, valor, descricao FROM (VALUES
  ('feature_onedrive', 'false', 'Integração OneDrive ativa'),
  ('feature_propostas', 'false', 'Módulo Propostas ativo'),
  ('feature_faturamento_lote', 'false', 'Faturamento em lote ativo'),
  ('feature_almoxarife', 'false', 'Módulo Almoxarife ativo'),
  ('feature_diario_bordo', 'false', 'Diário de bordo ativo'),
  ('feature_tv', 'false', 'Acompanhamento TV ativo'),
  ('feature_relatorios', 'false', 'Relatórios ativo'),
  ('feature_conciliacao', 'false', 'Conciliação bancária ativo'),
  ('feature_calendario', 'false', 'Calendário integrado ativo'),
  ('feature_campanhas', 'false', 'Campanhas comerciais ativo')
) AS t(chave, valor, descricao)
WHERE NOT EXISTS (SELECT 1 FROM admin_config WHERE admin_config.chave = t.chave);
