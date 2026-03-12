-- ============================================================================
-- 007_pedido_custo_tracking — Rastreamento de custo em pedido_itens
-- ============================================================================
-- NOTA: As colunas de custeio em pedido_itens já foram adicionadas pela
-- migration 007_orcamento_campos.sql, que é executada no mesmo slot 007.
--
-- Colunas já presentes em pedido_itens (adicionadas em 007_orcamento_campos):
--   - modelo_id          UUID REFERENCES produto_modelos(id) ON DELETE SET NULL
--   - custo_mp           NUMERIC(12,2) DEFAULT 0   -- custo matéria-prima
--   - custo_mo           NUMERIC(12,2) DEFAULT 0   -- custo mão de obra
--   - custo_fixo         NUMERIC(12,2) DEFAULT 0   -- custo fixo rateado
--   - markup_percentual  NUMERIC(5,2)  DEFAULT 40  -- markup aplicado
--   - largura_cm         NUMERIC(10,2)              -- dimensão largura
--   - altura_cm          NUMERIC(10,2)              -- dimensão altura
--   - area_m2            NUMERIC(10,4)              -- área calculada
--   - prazo_producao_dias INTEGER                   -- prazo de produção
--
-- Este arquivo garante que o schema seja idempotente caso 007_orcamento_campos
-- não tenha sido executado. Usa blocos DO $$ para adicionar apenas colunas
-- que ainda não existam.
-- ============================================================================

DO $$
BEGIN
  -- custo_mp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'custo_mp'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN custo_mp NUMERIC(12,2) DEFAULT 0;
    COMMENT ON COLUMN pedido_itens.custo_mp IS 'Custo de matéria-prima copiado da proposta';
  END IF;

  -- custo_mo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'custo_mo'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN custo_mo NUMERIC(12,2) DEFAULT 0;
    COMMENT ON COLUMN pedido_itens.custo_mo IS 'Custo de mão de obra copiado da proposta';
  END IF;

  -- custo_fixo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'custo_fixo'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN custo_fixo NUMERIC(12,2) DEFAULT 0;
    COMMENT ON COLUMN pedido_itens.custo_fixo IS 'Custo fixo rateado copiado da proposta';
  END IF;

  -- markup_percentual
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'markup_percentual'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN markup_percentual NUMERIC(8,2) DEFAULT 40;
    COMMENT ON COLUMN pedido_itens.markup_percentual IS 'Markup aplicado na precificação original';
  END IF;

  -- modelo_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'modelo_id'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN modelo_id UUID REFERENCES produto_modelos(id);
  END IF;

  -- largura_cm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'largura_cm'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN largura_cm NUMERIC(10,2);
  END IF;

  -- altura_cm
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'altura_cm'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN altura_cm NUMERIC(10,2);
  END IF;

  -- area_m2
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'area_m2'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN area_m2 NUMERIC(10,4);
  END IF;

  -- especificacao (já existe em 001 — verificação defensiva)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pedido_itens' AND column_name = 'especificacao'
  ) THEN
    ALTER TABLE pedido_itens ADD COLUMN especificacao TEXT;
  END IF;

END $$;

-- Índice para modelo_id (idempotente)
CREATE INDEX IF NOT EXISTS idx_pedido_itens_modelo
  ON pedido_itens(modelo_id)
  WHERE modelo_id IS NOT NULL;
