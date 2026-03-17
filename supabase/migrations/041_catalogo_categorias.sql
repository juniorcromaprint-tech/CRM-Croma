-- 041_catalogo_categorias.sql
-- Hierarquia de categorias de produto com parent_id

CREATE TABLE IF NOT EXISTS categorias_produto (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  parent_id    UUID REFERENCES categorias_produto(id) ON DELETE SET NULL,
  icone        TEXT,
  cor          TEXT,
  ordem        INT DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_produto_parent ON categorias_produto(parent_id);
CREATE INDEX IF NOT EXISTS idx_categorias_produto_slug ON categorias_produto(slug);

-- Trigger updated_at (usa função update_updated_at_column() já existente no schema)
CREATE OR REPLACE TRIGGER trg_categorias_produto_updated_at
  BEFORE UPDATE ON categorias_produto
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Vincular produtos à nova tabela (nullable para não quebrar dados existentes)
ALTER TABLE produtos
  ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES categorias_produto(id) ON DELETE SET NULL;

-- Seed: 9 categorias base da Croma Print
INSERT INTO categorias_produto (nome, slug, icone, cor, ordem) VALUES
  ('Banners e Faixas',    'banners',       'flag',        '#2563eb', 1),
  ('Adesivos',            'adesivos',      'sticker',     '#7c3aed', 2),
  ('Fachadas e ACM',      'fachadas',      'building2',   '#0891b2', 3),
  ('Placas',              'placas',        'square',      '#d97706', 4),
  ('Letreiros e Letras',  'letreiros',     'type',        '#dc2626', 5),
  ('Painéis e Totens',    'paineis',       'monitor',     '#059669', 6),
  ('Envelopamento',       'envelopamento', 'car',         '#db2777', 7),
  ('PDV e Display',       'pdv',           'shopping-bag','#6d28d9', 8),
  ('Serviços',            'servicos',      'wrench',      '#475569', 9)
ON CONFLICT (slug) DO NOTHING;
