-- Migration 019: Add fiscal/NCM fields to materiais table
-- Applied: 2026-03-11

ALTER TABLE materiais
  ADD COLUMN IF NOT EXISTS ncm text,
  ADD COLUMN IF NOT EXISTS venda_direta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS plano_contas_entrada text,
  ADD COLUMN IF NOT EXISTS plano_contas_saida text,
  ADD COLUMN IF NOT EXISTS data_referencia_preco date;
