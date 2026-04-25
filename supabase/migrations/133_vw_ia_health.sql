-- Migration 133: View de observabilidade do sistema IA
-- Extraído da produção em 2026-04-24 (código fantasma — existia no banco mas não no repo)
-- Usada pela página /admin/ia/health para monitoramento em tempo real
-- Agrega dados de: cron loop, regras, cobranças, ponte MCP, edge functions, memória IA, WhatsApp

CREATE OR REPLACE VIEW vw_ia_health AS
WITH ultimo_cron AS (
  SELECT
    system_events.created_at AS last_run,
    (system_events.payload ->> 'duration_ms')::integer AS duration_ms,
    (system_events.payload ->> 'rules_processed')::integer AS rules_processed,
    (system_events.payload ->> 'actions_success')::integer AS actions_success,
    (system_events.payload ->> 'actions_failed')::integer AS actions_failed,
    (system_events.payload ->> 'rules_skipped')::integer AS rules_skipped,
    (system_events.payload ->> 'rules_total_matches')::integer AS rules_total_matches
  FROM system_events
  WHERE system_events.event_type = 'cron_loop_executed'
  ORDER BY system_events.created_at DESC
  LIMIT 1
),
rules_24h AS (
  SELECT
    system_events.payload ->> 'rule_name' AS rule_name,
    count(*) AS execs
  FROM system_events
  WHERE system_events.event_type = 'rule_executed'
    AND system_events.created_at > (now() - '24:00:00'::interval)
  GROUP BY (system_events.payload ->> 'rule_name')
),
rules_agg AS (
  SELECT
    count(*)::integer AS rules_24h_total,
    max(rules_24h.execs)::integer AS rule_maior_volume,
    (SELECT rules_24h_1.rule_name FROM rules_24h rules_24h_1 ORDER BY rules_24h_1.execs DESC LIMIT 1) AS rule_dominante,
    max(rules_24h.execs) > 100 AS loop_anormal_vermelho,
    max(rules_24h.execs) >= 51 AND max(rules_24h.execs) <= 100 AS loop_anormal_amarelo
  FROM rules_24h
),
cobrancas_7d AS (
  SELECT
    count(*) FILTER (WHERE cobranca_automatica.created_at > (now() - '7 days'::interval)) AS cobrancas_7d,
    count(*) FILTER (WHERE cobranca_automatica.status = 'enviado' AND cobranca_automatica.created_at > (now() - '7 days'::interval)) AS cobrancas_enviadas_7d,
    count(*) AS cobrancas_total
  FROM cobranca_automatica
),
ponte_mcp AS (
  SELECT
    (SELECT count(*) FROM ai_requests) AS requests_total,
    (SELECT count(*) FROM ai_requests WHERE ai_requests.status = 'pending') AS requests_pending,
    (SELECT count(*) FROM ai_responses) AS responses_total,
    (SELECT max(ai_requests.created_at) FROM ai_requests) AS ultimo_request
),
edge_uso_30d AS (
  SELECT
    ai_logs.function_name,
    count(*) AS chamadas,
    max(ai_logs.created_at) AS ultima
  FROM ai_logs
  WHERE ai_logs.created_at > (now() - '30 days'::interval)
    AND ai_logs.function_name IS NOT NULL
  GROUP BY ai_logs.function_name
),
edge_agg AS (
  SELECT
    count(DISTINCT edge_uso_30d.function_name)::integer AS funcoes_usadas_30d,
    sum(edge_uso_30d.chamadas)::integer AS total_chamadas_30d
  FROM edge_uso_30d
),
memory_layer AS (
  SELECT
    (SELECT count(*) FROM ai_memory) AS padroes_total,
    (SELECT count(*) FROM ai_memory WHERE ai_memory.confianca >= 50) AS padroes_confiaveis,
    (SELECT max(ai_memory.updated_at) FROM ai_memory) AS ultimo_update
),
wpp_activity AS (
  SELECT
    (SELECT count(*) FROM agent_conversations WHERE agent_conversations.canal = 'whatsapp' AND agent_conversations.status = 'ativa') AS conversas_ativas,
    (SELECT count(*) FROM agent_messages WHERE agent_messages.canal = 'whatsapp' AND agent_messages.direcao = 'recebida' AND agent_messages.created_at > (now() - '7 days'::interval)) AS msgs_recebidas_7d,
    (SELECT max(agent_messages.created_at) FROM agent_messages WHERE agent_messages.canal = 'whatsapp') AS ultima_msg
)
SELECT
  uc.last_run AS cron_last_run,
  uc.duration_ms AS cron_duration_ms,
  uc.rules_processed AS cron_rules_processed,
  uc.actions_success AS cron_actions_success,
  uc.actions_failed AS cron_actions_failed,
  uc.rules_skipped AS cron_rules_skipped,
  EXTRACT(epoch FROM now() - uc.last_run) / 60::numeric AS cron_minutos_atras,
  ra.rules_24h_total,
  ra.rule_dominante,
  ra.rule_maior_volume,
  ra.loop_anormal_vermelho,
  ra.loop_anormal_amarelo,
  c7.cobrancas_7d,
  c7.cobrancas_enviadas_7d,
  c7.cobrancas_total,
  pm.requests_total AS ponte_requests_total,
  pm.requests_pending AS ponte_requests_pending,
  pm.responses_total AS ponte_responses_total,
  pm.ultimo_request AS ponte_ultimo_request,
  ea.funcoes_usadas_30d,
  ea.total_chamadas_30d,
  ml.padroes_total,
  ml.padroes_confiaveis,
  ml.ultimo_update AS memory_ultimo_update,
  wa.conversas_ativas,
  wa.msgs_recebidas_7d,
  wa.ultima_msg AS wpp_ultima_msg,
  now() AS computed_at
FROM ultimo_cron uc
  CROSS JOIN rules_agg ra
  CROSS JOIN cobrancas_7d c7
  CROSS JOIN ponte_mcp pm
  CROSS JOIN edge_agg ea
  CROSS JOIN memory_layer ml
  CROSS JOIN wpp_activity wa;

-- ══════════════════════════════════════════════════════════════════
-- vw_ia_health_edge_uso — uso detalhado de Edge Functions IA (30 dias)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_ia_health_edge_uso AS
SELECT
  function_name,
  count(*)::integer AS chamadas_30d,
  count(*) FILTER (WHERE status = 'error')::integer AS erros_30d,
  round(COALESCE(sum(cost_usd), 0::numeric), 4) AS custo_usd_30d,
  max(created_at) AS ultima_chamada
FROM ai_logs
WHERE created_at > (now() - '30 days'::interval) AND function_name IS NOT NULL
GROUP BY function_name
ORDER BY count(*) DESC;

-- ══════════════════════════════════════════════════════════════════
-- vw_ia_health_rules_24h — execução de regras do cron loop (24h)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_ia_health_rules_24h AS
SELECT
  payload ->> 'rule_name' AS rule_name,
  payload ->> 'action_type' AS action_type,
  entity_type AS modulo,
  count(*)::integer AS execucoes,
  CASE
    WHEN count(*) > 100 THEN 'vermelho'
    WHEN count(*) > 50 THEN 'amarelo'
    ELSE 'verde'
  END AS saude_loop
FROM system_events
WHERE event_type = 'rule_executed' AND created_at > (now() - '24:00:00'::interval)
GROUP BY (payload ->> 'rule_name'), (payload ->> 'action_type'), entity_type
ORDER BY count(*) DESC;

-- ══════════════════════════════════════════════════════════════════
-- vw_mcp_bridge_health — saúde da ponte MCP (ai_requests/ai_responses)
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW vw_mcp_bridge_health AS
SELECT
  count(*) FILTER (WHERE status = 'pendente') AS pendentes,
  count(*) FILTER (WHERE status = 'processado') AS processados,
  max(created_at) AS ultimo_request,
  (SELECT max(ai_responses.created_at) FROM ai_responses) AS ultima_response,
  EXTRACT(epoch FROM now() - max(created_at)) / 3600::numeric AS horas_desde_ultimo_request,
  CASE
    WHEN max(created_at) IS NULL THEN 'sem_atividade'
    WHEN max(created_at) < (now() - '24:00:00'::interval) THEN 'critico'
    WHEN max(created_at) < (now() - '02:00:00'::interval) THEN 'alerta'
    ELSE 'ok'
  END AS saude
FROM ai_requests;
