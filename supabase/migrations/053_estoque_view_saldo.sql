-- Migration 053: view v_estoque_saldos (saldo computado) + estoque_ideal em materiais

-- Adiciona estoque_ideal em materiais (semáforo precisa de dois limiares)
ALTER TABLE materiais
  ADD COLUMN IF NOT EXISTS estoque_ideal NUMERIC(12,3) DEFAULT 0;

-- View v_estoque_saldos: saldo computado a partir de movimentações
CREATE OR REPLACE VIEW v_estoque_saldos AS
SELECT
  m.id AS material_id,
  m.nome,
  m.unidade,
  m.estoque_minimo,
  m.estoque_ideal,
  m.preco_medio,
  COALESCE(SUM(
    CASE
      WHEN em.tipo IN ('entrada', 'devolucao', 'liberacao_reserva', 'ajuste') THEN em.quantidade
      WHEN em.tipo IN ('saida', 'reserva') THEN -em.quantidade
      ELSE 0
    END
  ), 0) AS saldo_disponivel,
  COALESCE(
    SUM(CASE WHEN em.tipo = 'reserva' THEN em.quantidade ELSE 0 END)
    - SUM(CASE WHEN em.tipo = 'liberacao_reserva' THEN em.quantidade ELSE 0 END),
    0
  ) AS saldo_reservado,
  COUNT(em.id) AS total_movimentacoes,
  MAX(em.created_at) AS ultima_movimentacao
FROM materiais m
LEFT JOIN estoque_movimentacoes em ON em.material_id = m.id
WHERE m.ativo = TRUE
GROUP BY m.id, m.nome, m.unidade, m.estoque_minimo, m.estoque_ideal, m.preco_medio;

COMMENT ON VIEW v_estoque_saldos IS 'Saldo real computado de movimentações — nunca editar diretamente';
