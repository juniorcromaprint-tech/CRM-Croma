-- Migration 057: view v_estoque_semaforo — verde/amarelo/vermelho

CREATE OR REPLACE VIEW v_estoque_semaforo AS
SELECT
  vs.material_id,
  vs.nome,
  vs.unidade,
  vs.saldo_disponivel,
  vs.saldo_reservado,
  vs.estoque_minimo,
  vs.estoque_ideal,
  vs.preco_medio,
  vs.ultima_movimentacao,
  CASE
    WHEN vs.estoque_ideal > 0 AND vs.saldo_disponivel >= vs.estoque_ideal THEN 'verde'
    WHEN vs.estoque_minimo > 0 AND vs.saldo_disponivel < vs.estoque_minimo THEN 'vermelho'
    WHEN vs.saldo_disponivel >= COALESCE(vs.estoque_minimo, 0) THEN 'amarelo'
    ELSE 'amarelo'
  END AS semaforo,
  GREATEST(0, COALESCE(NULLIF(vs.estoque_ideal, 0), vs.estoque_minimo * 2, 0) - vs.saldo_disponivel) AS qtd_reposicao_sugerida
FROM v_estoque_saldos vs;

COMMENT ON VIEW v_estoque_semaforo IS 'Saldo com semáforo verde/amarelo/vermelho e sugestão de reposição';
