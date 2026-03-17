-- Migration: 036_pricing_realista.sql
-- Precificação Realista — encargos, aproveitamento por categoria, máquinas

-- 1. Encargos trabalhistas na config
ALTER TABLE config_precificacao
  ADD COLUMN IF NOT EXISTS percentual_encargos NUMERIC(5,2) DEFAULT 0;

-- 2. Aproveitamento padrão por categoria (regras_precificacao)
ALTER TABLE regras_precificacao
  ADD COLUMN IF NOT EXISTS aproveitamento_padrao NUMERIC(5,2) DEFAULT 85;

-- Atualizar aproveitamento por categoria
UPDATE regras_precificacao SET aproveitamento_padrao = 90 WHERE categoria = 'banner';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'adesivo';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'fachada';
UPDATE regras_precificacao SET aproveitamento_padrao = 80 WHERE categoria = 'letreiro';
UPDATE regras_precificacao SET aproveitamento_padrao = 75 WHERE categoria = 'envelopamento';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'placa';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'painel';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'totem';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'backdrop';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'pdv';
UPDATE regras_precificacao SET aproveitamento_padrao = 85 WHERE categoria = 'geral';

-- 3. Tabela de máquinas
CREATE TABLE IF NOT EXISTS maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- impressao, corte, acabamento, outro
  custo_hora NUMERIC(12,4) DEFAULT 0,
  custo_m2 NUMERIC(12,4) DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Junction table: item de orçamento ↔ máquinas
CREATE TABLE IF NOT EXISTS orcamento_item_maquinas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_item_id UUID REFERENCES proposta_itens(id) ON DELETE CASCADE,
  maquina_id UUID NOT NULL REFERENCES maquinas(id) ON DELETE CASCADE,
  tempo_minutos NUMERIC(10,2) DEFAULT 0,
  area_m2 NUMERIC(10,4) DEFAULT 0,
  custo_calculado NUMERIC(12,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oim_proposta_item ON orcamento_item_maquinas(proposta_item_id);
CREATE INDEX IF NOT EXISTS idx_oim_maquina ON orcamento_item_maquinas(maquina_id);

-- 5. Seed 6 máquinas padrão (custo 0 — usuário preenche)
INSERT INTO maquinas (nome, tipo, custo_hora, custo_m2) VALUES
  ('Impressora Solvente', 'impressao', 0, 0),
  ('HP Latex 365', 'impressao', 0, 0),
  ('Plotter de Recorte', 'corte', 0, 0),
  ('Router CNC', 'corte', 0, 0),
  ('Laminadora', 'acabamento', 0, 0),
  ('Solda Banner', 'acabamento', 0, 0)
ON CONFLICT DO NOTHING;

-- 6. RLS
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamento_item_maquinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maquinas_select" ON maquinas
  FOR SELECT USING (true);

CREATE POLICY "maquinas_manage" ON maquinas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente'))
  );

CREATE POLICY "oim_select" ON orcamento_item_maquinas
  FOR SELECT USING (true);

CREATE POLICY "oim_manage" ON orcamento_item_maquinas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'comercial'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente', 'comercial'))
  );
