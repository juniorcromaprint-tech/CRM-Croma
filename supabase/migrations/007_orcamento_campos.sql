-- =============================================================
-- Migration 007: Campos técnicos de custeio + rastreabilidade
-- Data: 2026-03-10
-- =============================================================

-- 1. proposta_itens: adicionar modelo_id para rastreabilidade
-- (permite saber qual modelo de produto originou o item)
ALTER TABLE proposta_itens
  ADD COLUMN IF NOT EXISTS modelo_id UUID REFERENCES produto_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposta_itens_modelo
  ON proposta_itens(modelo_id)
  WHERE modelo_id IS NOT NULL;

-- 2. pedido_itens: adicionar campos técnicos de custeio
-- (garante que dados de custeio não se percam na conversão orçamento→pedido)
ALTER TABLE pedido_itens
  ADD COLUMN IF NOT EXISTS modelo_id          UUID REFERENCES produto_modelos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS custo_mp           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mo           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_fixo         NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS markup_percentual  NUMERIC(5,2)  DEFAULT 40,
  ADD COLUMN IF NOT EXISTS largura_cm         NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS altura_cm          NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS area_m2            NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS prazo_producao_dias INTEGER;

CREATE INDEX IF NOT EXISTS idx_pedido_itens_modelo
  ON pedido_itens(modelo_id)
  WHERE modelo_id IS NOT NULL;

-- 3. Remover tabela regras_precificacao gerada pela 006 (se existir)
-- e recriar com schema colunar mais legível e compatível com o frontend
DROP TABLE IF EXISTS regras_precificacao CASCADE;

CREATE TABLE regras_precificacao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria       TEXT NOT NULL,
  markup_minimo   NUMERIC(5,2) NOT NULL DEFAULT 30,
  markup_sugerido NUMERIC(5,2) NOT NULL DEFAULT 45,
  desconto_maximo NUMERIC(5,2) DEFAULT 15,
  preco_m2_minimo NUMERIC(12,2),
  taxa_urgencia   NUMERIC(5,2) DEFAULT 50,
  ativo           BOOLEAN DEFAULT TRUE,
  criado_por      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para updated_at
CREATE TRIGGER trigger_regras_precificacao_updated_at
  BEFORE UPDATE ON regras_precificacao
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE regras_precificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_precificacao_select" ON regras_precificacao
  FOR SELECT USING (true);

CREATE POLICY "regras_precificacao_all_admin" ON regras_precificacao
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'diretor')
    )
  );

-- Índices
CREATE INDEX idx_regras_precificacao_categoria ON regras_precificacao(categoria);
CREATE INDEX idx_regras_precificacao_ativo ON regras_precificacao(ativo) WHERE ativo = TRUE;

-- Seed: regras por categoria de produto de comunicação visual
INSERT INTO regras_precificacao (categoria, markup_minimo, markup_sugerido, desconto_maximo, preco_m2_minimo, taxa_urgencia) VALUES
  ('banner',    30, 45, 15,  18.00, 50),
  ('adesivo',   35, 50, 10,  22.00, 50),
  ('fachada',   40, 60, 10,  85.00, 30),
  ('placa',     35, 55, 12,  45.00, 40),
  ('letreiro',  45, 70,  8, 120.00, 30),
  ('painel',    40, 60, 10,  65.00, 40),
  ('totem',     45, 65,  8,  95.00, 25),
  ('backdrop',  30, 45, 15,  20.00, 50),
  ('geral',     30, 45, 15,   NULL, 50);

-- 4. Criar índices adicionais úteis para o módulo de orçamento
CREATE INDEX IF NOT EXISTS idx_proposta_itens_produto
  ON proposta_itens(produto_id)
  WHERE produto_id IS NOT NULL;

-- 5. Adicionar coluna aprovado_por em propostas se não existir
-- (para rastreabilidade de quem aprovou o orçamento)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'propostas' AND column_name = 'aprovado_por'
  ) THEN
    ALTER TABLE propostas ADD COLUMN aprovado_por UUID REFERENCES profiles(id) ON DELETE SET NULL;
    ALTER TABLE propostas ADD COLUMN aprovado_em TIMESTAMPTZ;
  END IF;
END $$;

-- Comentário final
COMMENT ON TABLE regras_precificacao IS 'Regras de markup mínimo/sugerido e descontos por categoria de produto. Schema colunar (migration 007, substituiu schema tipo/valor da 006).';
COMMENT ON TABLE proposta_itens IS 'Itens de propostas/orçamentos. modelo_id adicionado na migration 007 para rastreabilidade.';
COMMENT ON TABLE pedido_itens IS 'Itens de pedidos. Campos de custeio adicionados na migration 007 para não perder dados na conversão orçamento→pedido.';
