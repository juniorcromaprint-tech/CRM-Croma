-- ============================================================================
-- Migration 026: Seed acabamentos table with Croma Print standard finishes
-- ============================================================================
-- Removes duplicate rows from earlier seeds, then adds the 7 missing
-- acabamentos (Solda Eletrônica, Costura, Canaleta, Dobra e Reforço,
-- Corte Especial, Aplicação em ACM, Instalação de Letra Caixa).
-- Uses WHERE NOT EXISTS to be idempotent on re-run.
-- ============================================================================

-- Remove duplicate rows (second seed batch without accents, created ~22:07 UTC on 2026-03-10)
DELETE FROM acabamentos
WHERE created_at >= '2026-03-10 22:00:00+00'
  AND created_at < '2026-03-10 23:00:00+00';

-- Insert missing acabamentos (idempotent via case-insensitive name check)
INSERT INTO acabamentos (nome, descricao, custo_unitario, unidade, ordem, ativo)
SELECT nome, descricao, custo_unitario, unidade, ordem, ativo
FROM (VALUES
  ('Solda Eletrônica', 'Emenda por solda eletrônica de alta frequência', 12.00::numeric, 'm', 11, true),
  ('Costura', 'Costura industrial reforçada para lonas', 6.00::numeric, 'm', 12, true),
  ('Canaleta', 'Canaleta de alumínio para fixação em testeira', 18.00::numeric, 'm', 13, true),
  ('Dobra e Reforço', 'Dobra com reforço para fixação mecânica', 3.00::numeric, 'm', 14, true),
  ('Corte Especial', 'Corte CNC ou plotter para formatos especiais', 5.00::numeric, 'un', 15, true),
  ('Aplicação em ACM', 'Aplicação de adesivo sobre painel ACM', 25.00::numeric, 'm²', 16, true),
  ('Instalação de Letra Caixa', 'Montagem e fixação de letras em caixa', 35.00::numeric, 'un', 17, true)
) AS v(nome, descricao, custo_unitario, unidade, ordem, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM acabamentos a WHERE lower(a.nome) = lower(v.nome)
);
