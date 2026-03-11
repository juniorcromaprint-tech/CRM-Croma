-- ============================================================================
-- 018 — CONFIG PRECIFICAÇÃO + SNAPSHOT DE CUSTOS
-- Tabela de configuração real + snapshot no orçamento
-- Pré-requisito: 001, 006, 009
-- ============================================================================

-- Tabela de configuração de precificação (dados reais da empresa)
CREATE TABLE IF NOT EXISTS config_precificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faturamento_medio NUMERIC(14,2) NOT NULL DEFAULT 110000,
  custo_operacional NUMERIC(14,2) NOT NULL DEFAULT 36800,
  custo_produtivo NUMERIC(14,2) NOT NULL DEFAULT 23744,
  qtd_funcionarios INTEGER NOT NULL DEFAULT 6,
  horas_mes NUMERIC(8,2) NOT NULL DEFAULT 176,
  percentual_comissao NUMERIC(5,2) NOT NULL DEFAULT 5,
  percentual_impostos NUMERIC(5,2) NOT NULL DEFAULT 12,
  percentual_juros NUMERIC(5,2) NOT NULL DEFAULT 2,
  atualizado_por UUID REFERENCES profiles(id),
  vigencia_inicio DATE DEFAULT CURRENT_DATE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed com valores padrão Croma Print
INSERT INTO config_precificacao (
  faturamento_medio, custo_operacional, custo_produtivo,
  qtd_funcionarios, horas_mes,
  percentual_comissao, percentual_impostos, percentual_juros
) SELECT
  110000, 36800, 23744,
  6, 176,
  5, 12, 2
WHERE NOT EXISTS (SELECT 1 FROM config_precificacao LIMIT 1);

-- Snapshot de custos no orçamento (imutabilidade)
ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS config_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS total NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_percentual NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS validade_dias INTEGER DEFAULT 10;

-- Campos adicionais em proposta_itens (alguns podem já existir de migration 007)
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES produto_modelos(id),
  ADD COLUMN IF NOT EXISTS especificacao TEXT,
  ADD COLUMN IF NOT EXISTS custo_mp NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mo NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_fixo NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS area_m2 NUMERIC(10,4);

-- Tabela de processos por item (complementa 006)
CREATE TABLE IF NOT EXISTS proposta_item_processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_item_id UUID NOT NULL REFERENCES proposta_itens(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  tempo_minutos NUMERIC(8,2) NOT NULL DEFAULT 0,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_config_precificacao_ativo ON config_precificacao(ativo);
CREATE INDEX IF NOT EXISTS idx_proposta_item_processos_item ON proposta_item_processos(proposta_item_id);

-- RLS
ALTER TABLE config_precificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_item_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados_ver_config" ON config_precificacao
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "admin_editar_config" ON config_precificacao
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'financeiro', 'diretor'))
  WITH CHECK (get_user_role() IN ('admin', 'financeiro', 'diretor'));

CREATE POLICY "autenticados_ver_item_processos" ON proposta_item_processos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comercial_editar_item_processos" ON proposta_item_processos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'comercial', 'comercial_senior'))
  WITH CHECK (get_user_role() IN ('admin', 'comercial', 'comercial_senior'));

-- ─── Verificação ──────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM config_precificacao) AS configs,
  (SELECT count(*) FROM information_schema.columns
   WHERE table_name = 'propostas' AND column_name = 'config_snapshot') AS has_snapshot;
