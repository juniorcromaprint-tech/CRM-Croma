-- Migration 055: rastreabilidade lote + custo_unitario em estoque_movimentacoes

ALTER TABLE estoque_movimentacoes
  ADD COLUMN IF NOT EXISTS lote TEXT,
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(12,4);

COMMENT ON COLUMN estoque_movimentacoes.lote IS 'Número do lote para rastreabilidade futura (nullable)';
COMMENT ON COLUMN estoque_movimentacoes.custo_unitario IS 'Custo unitário no momento da movimentação (para custo médio ponderado)';
