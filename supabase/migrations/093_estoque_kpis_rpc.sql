-- 093_estoque_kpis_rpc.sql
-- RPC para KPIs do estoque — elimina fetch de 500 movimentações no client

CREATE OR REPLACE FUNCTION rpc_estoque_kpis()
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'total_materiais', (SELECT COUNT(*) FROM v_estoque_semaforo),
    'critico', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'vermelho'),
    'atencao', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'amarelo'),
    'normal', (SELECT COUNT(*) FROM v_estoque_semaforo WHERE semaforo = 'verde'),
    'entradas_mes', (
      SELECT COALESCE(SUM(quantidade), 0)
      FROM estoque_movimentacoes
      WHERE tipo = 'entrada'
        AND created_at >= date_trunc('month', now())
    ),
    'saidas_mes', (
      SELECT COALESCE(SUM(quantidade), 0)
      FROM estoque_movimentacoes
      WHERE tipo = 'saida'
        AND created_at >= date_trunc('month', now())
    )
  );
$$;
