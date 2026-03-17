-- 061_pcp_views.sql
-- Views de KPI para o Dashboard PCP

-- v_pcp_ops_ativas: OPs em andamento com dados completos para Kanban e KPIs
CREATE OR REPLACE VIEW v_pcp_ops_ativas AS
SELECT
  op.id,
  op.numero,
  op.status,
  op.prioridade,
  op.prazo_interno,
  op.data_inicio,
  op.data_conclusao,
  op.tempo_estimado_min,
  op.tempo_real_min,
  op.restricao_financeira,
  op.setor_atual_id,
  s.nome AS setor_atual_nome,
  s.cor AS setor_cor,
  p.id AS pedido_id,
  p.numero AS pedido_numero,
  p.data_prometida,
  c.id AS cliente_id,
  c.razao_social AS cliente_nome,
  CASE
    WHEN op.prazo_interno IS NOT NULL
     AND op.prazo_interno < CURRENT_DATE
     AND op.status NOT IN ('finalizado', 'liberado')
    THEN TRUE ELSE FALSE
  END AS atrasada,
  CASE
    WHEN op.prazo_interno IS NOT NULL AND op.prazo_interno < CURRENT_DATE
    THEN CURRENT_DATE - op.prazo_interno ELSE 0
  END AS dias_atraso,
  op.created_at,
  op.updated_at
FROM ordens_producao op
LEFT JOIN setores_producao s ON s.id = op.setor_atual_id
LEFT JOIN pedidos p ON p.id = op.pedido_id
LEFT JOIN clientes c ON c.id = p.cliente_id
WHERE op.status NOT IN ('finalizado')
  AND (op.excluido_em IS NULL OR op.excluido_em > NOW());

-- v_pcp_capacidade_setor: utilização por setor
CREATE OR REPLACE VIEW v_pcp_capacidade_setor AS
SELECT
  s.id AS setor_id,
  s.nome AS setor_nome,
  s.cor,
  s.capacidade_diaria_min,
  COUNT(DISTINCT op.id) AS ops_ativas,
  COALESCE(SUM(op.tempo_estimado_min), 0) AS min_total_estimado,
  ROUND(
    COALESCE(SUM(op.tempo_estimado_min), 0)::numeric /
    NULLIF(s.capacidade_diaria_min, 0) * 100, 1
  ) AS utilizacao_pct
FROM setores_producao s
LEFT JOIN ordens_producao op ON op.setor_atual_id = s.id
  AND op.status NOT IN ('finalizado', 'liberado')
  AND (op.excluido_em IS NULL OR op.excluido_em > NOW())
WHERE s.ativo = TRUE
GROUP BY s.id, s.nome, s.cor, s.capacidade_diaria_min
ORDER BY s.ordem;

-- v_pcp_apontamentos_hoje: apontamentos do dia para Gantt
CREATE OR REPLACE VIEW v_pcp_apontamentos_hoje AS
SELECT
  a.id,
  a.producao_etapa_id,
  a.ordem_producao_id,
  a.operador_id,
  pr.full_name AS operador_nome,
  a.inicio,
  a.fim,
  a.tempo_minutos,
  a.tipo,
  op.numero AS op_numero,
  op.setor_atual_id,
  e.nome AS etapa_nome,
  s.nome AS setor_nome,
  s.cor AS setor_cor
FROM producao_apontamentos a
JOIN ordens_producao op ON op.id = a.ordem_producao_id
JOIN producao_etapas e ON e.id = a.producao_etapa_id
LEFT JOIN setores_producao s ON s.id = op.setor_atual_id
LEFT JOIN profiles pr ON pr.id = a.operador_id
WHERE DATE(a.inicio AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE;
