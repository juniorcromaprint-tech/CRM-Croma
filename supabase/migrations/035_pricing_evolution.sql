-- Migration: 035_pricing_evolution.sql
-- Pricing Evolution — spec 2026-03-16

-- 1. Remove preco_fixo from produto_modelos (bypass risk)
-- NOTE: servicos.preco_fixo is a DIFFERENT column and MUST be kept
ALTER TABLE produto_modelos DROP COLUMN IF EXISTS preco_fixo;

-- 2. Audit flag for price override
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS preco_override BOOLEAN DEFAULT false;

-- 3. Setup time per process
ALTER TABLE modelo_processos
  ADD COLUMN IF NOT EXISTS tempo_setup_min INTEGER NOT NULL DEFAULT 0;

-- 4. Volume quantity discount tiers
CREATE TABLE IF NOT EXISTS faixas_quantidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID NOT NULL REFERENCES regras_precificacao(id) ON DELETE CASCADE,
  quantidade_minima INTEGER NOT NULL,
  desconto_markup_percentual NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_faixas_regra_qtd UNIQUE (regra_id, quantidade_minima)
);

CREATE INDEX IF NOT EXISTS idx_faixas_quantidade_regra
  ON faixas_quantidade(regra_id);

-- Seed default tiers for banner category
-- Note: Only 'banner' category seeded here as starting point.
-- Other categories can be configured via Admin > Configurações > Precificação.
INSERT INTO faixas_quantidade (regra_id, quantidade_minima, desconto_markup_percentual)
SELECT r.id, faixa.qtd, faixa.desconto
FROM regras_precificacao r
CROSS JOIN (VALUES
  (10, 3.0),
  (50, 7.0),
  (100, 12.0)
) AS faixa(qtd, desconto)
WHERE r.categoria = 'banner' AND r.ativo = true
ON CONFLICT ON CONSTRAINT uq_faixas_regra_qtd DO NOTHING;

-- 5. Material price history with auto-trigger
CREATE TABLE IF NOT EXISTS materiais_historico_preco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  preco_anterior NUMERIC(12,4),
  preco_novo NUMERIC(12,4) NOT NULL,
  motivo TEXT,
  atualizado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mat_hist_material
  ON materiais_historico_preco(material_id, created_at DESC);

CREATE OR REPLACE FUNCTION fn_log_preco_material()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.preco_medio IS DISTINCT FROM NEW.preco_medio THEN
    -- NOTE: atualizado_por will be NULL for service-role/backend updates (no JWT context)
    -- This is expected behavior consistent with existing trigger patterns in this project
    INSERT INTO materiais_historico_preco (material_id, preco_anterior, preco_novo, atualizado_por)
    VALUES (NEW.id, OLD.preco_medio, NEW.preco_medio, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_preco_material ON materiais;
CREATE TRIGGER trg_log_preco_material
  AFTER UPDATE ON materiais
  FOR EACH ROW EXECUTE FUNCTION fn_log_preco_material();

-- 6. RLS
ALTER TABLE faixas_quantidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiais_historico_preco ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faixas_quantidade_select" ON faixas_quantidade
  FOR SELECT USING (true);

CREATE POLICY "faixas_quantidade_manage" ON faixas_quantidade
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  );

CREATE POLICY "materiais_historico_select" ON materiais_historico_preco
  FOR SELECT USING (true);

CREATE POLICY "materiais_historico_insert" ON materiais_historico_preco
  FOR INSERT WITH CHECK (true);
