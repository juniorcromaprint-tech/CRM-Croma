-- Migration 106: Views do Cockpit Executivo + Automação + Tabelas de suporte
-- UX-02 + CRON-01 suporte
-- Data: 2026-03-31

-- ═══════════════════════════════════════════════════
-- PARTE 1: Tabela agent_rules (motor de regras do agent-cron-loop)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agent_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  modulo TEXT NOT NULL DEFAULT 'geral',
  tipo TEXT NOT NULL DEFAULT 'automatica',
  ativo BOOLEAN NOT NULL DEFAULT true,
  prioridade INT DEFAULT 0,
  condicao JSONB DEFAULT '{}',
  acao JSONB DEFAULT '{}',
  canal TEXT DEFAULT 'sistema',
  last_run TIMESTAMPTZ,
  run_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE agent_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_rules_service" ON agent_rules FOR ALL TO service_role USING (true);
CREATE POLICY "agent_rules_select" ON agent_rules FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE agent_rules IS 'Regras de automação do agent-cron-loop — CROMA 4.0 Fase 3';

-- ═══════════════════════════════════════════════════
-- PARTE 2: Tabela cobranca_automatica (registro de cobranças)
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cobranca_automatica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id UUID REFERENCES contas_receber(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES pedidos(id) ON DELETE SET NULL,
  nivel INT NOT NULL DEFAULT 1,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pendente',
  mensagem TEXT,
  erro_mensagem TEXT,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE cobranca_automatica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cobranca_auto_service" ON cobranca_automatica FOR ALL TO service_role USING (true);
CREATE POLICY "cobranca_auto_select" ON cobranca_automatica FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cobranca_auto_cr ON cobranca_automatica(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_cobranca_auto_created ON cobranca_automatica(created_at DESC);

COMMENT ON TABLE cobranca_automatica IS 'Registro de cobranças automáticas escalonadas — CROMA 4.0';

-- ═══════════════════════════════════════════════════
-- PARTE 3: Seed agent_rules (15 regras)
-- ═══════════════════════════════════════════════════

INSERT INTO agent_rules (nome, descricao, modulo, tipo, prioridade, canal) VALUES
  ('Cobrança D+1', 'Enviar lembrete amigável 1 dia após vencimento', 'financeiro', 'cobranca', 10, 'whatsapp'),
  ('Cobrança D+3', 'Enviar segundo lembrete 3 dias após vencimento', 'financeiro', 'cobranca', 9, 'whatsapp'),
  ('Cobrança D+7', 'Enviar cobrança formal 7 dias após vencimento', 'financeiro', 'cobranca', 8, 'email'),
  ('Cobrança D+15', 'Enviar notificação urgente 15 dias após vencimento', 'financeiro', 'cobranca', 7, 'email'),
  ('Cobrança D+30', 'Escalar para Junior via Telegram 30 dias após vencimento', 'financeiro', 'cobranca', 6, 'telegram'),
  ('Alerta estoque mínimo', 'Alertar quando material atinge estoque mínimo', 'estoque', 'alerta', 5, 'telegram'),
  ('Follow-up lead 3d', 'Follow-up automático para leads sem resposta há 3 dias', 'comercial', 'follow_up', 4, 'whatsapp'),
  ('Follow-up lead 7d', 'Follow-up para leads sem resposta há 7 dias', 'comercial', 'follow_up', 3, 'email'),
  ('Follow-up proposta 2d', 'Lembrete de proposta enviada há 2 dias sem resposta', 'comercial', 'follow_up', 4, 'whatsapp'),
  ('PCP sequenciamento', 'Sequenciar OPs na fila de produção por prioridade', 'producao', 'automatica', 10, 'sistema'),
  ('Transição produção→instalação', 'Mover pedido para instalação quando OP finalizada', 'producao', 'transicao', 9, 'sistema'),
  ('Alerta OP atrasada', 'Alertar sobre OPs com prazo vencido', 'producao', 'alerta', 7, 'telegram'),
  ('Alerta instalação pendente', 'Alertar instalações agendadas para hoje/amanhã', 'instalacao', 'alerta', 6, 'telegram'),
  ('Resumo diário', 'Gerar e enviar resumo diário no Telegram às 22h', 'geral', 'relatorio', 1, 'telegram'),
  ('Detectar pagamentos vencidos', 'Executar fn_detect_overdue_payments diariamente', 'financeiro', 'automatica', 10, 'sistema')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════
-- PARTE 4: VIEW vw_cockpit_executivo
-- Métricas consolidadas para o Cockpit Executivo
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_cockpit_executivo AS
SELECT
  -- Faturado hoje
  COALESCE((
    SELECT SUM(cr.valor_original)
    FROM contas_receber cr
    WHERE cr.status = 'pago'
      AND cr.data_pagamento = CURRENT_DATE
  ), 0) AS faturado_hoje,

  -- Pipeline ativo (propostas em andamento)
  COALESCE((
    SELECT SUM(p.total)
    FROM propostas p
    WHERE p.status IN ('enviada', 'em_analise', 'negociacao')
  ), 0) AS pipeline_ativo,

  -- Vencidos count
  COALESCE((
    SELECT COUNT(*)
    FROM contas_receber cr
    WHERE cr.status IN ('vencido', 'aberto')
      AND cr.data_vencimento < CURRENT_DATE
      AND cr.saldo > 0
  ), 0)::int AS vencidos_count,

  -- Vencidos valor
  COALESCE((
    SELECT SUM(COALESCE(cr.saldo, cr.valor_original))
    FROM contas_receber cr
    WHERE cr.status IN ('vencido', 'aberto')
      AND cr.data_vencimento < CURRENT_DATE
      AND cr.saldo > 0
  ), 0) AS vencidos_valor,

  -- Receita do mês
  COALESCE((
    SELECT SUM(cr.valor_pago)
    FROM contas_receber cr
    WHERE cr.status = 'pago'
      AND cr.data_pagamento >= date_trunc('month', CURRENT_DATE)
      AND cr.data_pagamento < date_trunc('month', CURRENT_DATE) + interval '1 month'
  ), 0) AS receita_mes,

  -- A receber nos próximos 7 dias
  COALESCE((
    SELECT SUM(COALESCE(cr.saldo, cr.valor_original))
    FROM contas_receber cr
    WHERE cr.status IN ('a_vencer', 'previsto', 'faturado')
      AND cr.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  ), 0) AS a_receber_7d,

  -- A pagar nos próximos 7 dias
  COALESCE((
    SELECT SUM(COALESCE(cp.saldo, cp.valor_original))
    FROM contas_pagar cp
    WHERE cp.status = 'a_pagar'
      AND cp.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
  ), 0) AS a_pagar_7d,

  -- OPs abertas
  COALESCE((
    SELECT COUNT(*)
    FROM ordens_producao op
    WHERE op.status NOT IN ('finalizado', 'cancelado')
  ), 0)::int AS ops_abertas,

  -- OPs atrasadas
  COALESCE((
    SELECT COUNT(*)
    FROM ordens_producao op
    WHERE op.status NOT IN ('finalizado', 'cancelado')
      AND op.prazo_interno < CURRENT_DATE
  ), 0)::int AS ops_atrasadas,

  -- Leads novos (7d)
  COALESCE((
    SELECT COUNT(*)
    FROM leads l
    WHERE l.created_at >= now() - interval '7 days'
  ), 0)::int AS leads_novos_7d,

  -- Propostas (7d)
  COALESCE((
    SELECT COUNT(*)
    FROM propostas p
    WHERE p.created_at >= now() - interval '7 days'
  ), 0)::int AS propostas_7d,

  -- Cobranças automáticas (7d)
  COALESCE((
    SELECT COUNT(*)
    FROM cobranca_automatica ca
    WHERE ca.created_at >= now() - interval '7 days'
  ), 0)::int AS cobrancas_7d,

  -- Eventos do sistema (7d)
  COALESCE((
    SELECT COUNT(*)
    FROM system_events se
    WHERE se.created_at >= now() - interval '7 days'
  ), 0)::int AS eventos_7d;

-- ═══════════════════════════════════════════════════
-- PARTE 5: VIEW vw_cockpit_timeline
-- Timeline de eventos formatada
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_cockpit_timeline AS
SELECT
  se.id,
  se.created_at,
  se.event_type,
  se.entity_type,
  se.entity_id::text AS entity_id,
  se.payload,
  CASE se.event_type
    WHEN 'production_completed' THEN 'Produção finalizada — Pedido ' || COALESCE(se.payload->>'pedido_numero', '#')
    WHEN 'installation_completed' THEN 'Instalação concluída'
    WHEN 'payment_received' THEN 'Pagamento recebido — ' || COALESCE(se.payload->>'valor', '0')
    WHEN 'payment_overdue' THEN 'Pagamento vencido — ' || COALESCE(se.payload->>'dias_atraso', '?') || ' dias'
    WHEN 'alert_generated' THEN COALESCE(se.payload->>'message', 'Alerta do sistema')
    WHEN 'cron_loop_executed' THEN 'Motor de automação executado'
    WHEN 'rule_executed' THEN 'Regra executada: ' || COALESCE(se.payload->>'rule_name', '?')
    WHEN 'daily_summary' THEN 'Resumo diário gerado'
    WHEN 'daily_closing' THEN 'Fechamento diário'
    WHEN 'production_completed_transition' THEN 'Produção concluída — transição automática'
    WHEN 'installation_order_auto_created' THEN 'Ordem de instalação criada automaticamente'
    ELSE replace(se.event_type, '_', ' ')
  END AS descricao_formatada
FROM system_events se
ORDER BY se.created_at DESC;

-- ═══════════════════════════════════════════════════
-- PARTE 6: VIEW vw_automacao_cobrancas
-- Cobranças automáticas com dados do cliente/pedido
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_automacao_cobrancas AS
SELECT
  ca.id,
  c.nome_fantasia AS cliente_nome,
  ca.nivel,
  ca.canal,
  ca.status,
  (CURRENT_DATE - cr.data_vencimento) AS dias_atraso,
  cr.valor_original,
  COALESCE(cr.saldo, cr.valor_original) AS saldo,
  cr.data_vencimento,
  ped.numero AS pedido_numero,
  ca.enviado_em,
  ca.created_at,
  ca.erro_mensagem
FROM cobranca_automatica ca
JOIN contas_receber cr ON cr.id = ca.conta_receber_id
JOIN clientes c ON c.id = ca.cliente_id
LEFT JOIN pedidos ped ON ped.id = ca.pedido_id
ORDER BY ca.created_at DESC;

-- ═══════════════════════════════════════════════════
-- PARTE 7: VIEW vw_automacao_rules_status
-- Status das regras de automação
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_automacao_rules_status AS
SELECT
  ar.id,
  ar.modulo,
  ar.tipo,
  ar.nome,
  ar.descricao,
  ar.ativo,
  ar.prioridade,
  ar.last_run,
  ar.run_count,
  ar.last_error
FROM agent_rules ar
ORDER BY ar.modulo, ar.prioridade DESC;

-- ═══════════════════════════════════════════════════
-- PARTE 8: VIEW vw_fila_producao
-- Fila de produção para PCP
-- ═══════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_fila_producao AS
SELECT
  op.id,
  op.numero,
  op.status,
  COALESCE(op.prioridade, 0) AS prioridade,
  NULL::text AS maquina_nome,
  CASE op.status
    WHEN 'aguardando_programacao' THEN 'Aguardando'
    WHEN 'em_fila' THEN 'Fila'
    WHEN 'em_producao' THEN 'Produção'
    WHEN 'em_acabamento' THEN 'Acabamento'
    WHEN 'em_conferencia' THEN 'Conferência'
    WHEN 'liberado' THEN 'Liberado'
    WHEN 'retrabalho' THEN 'Retrabalho'
    ELSE op.status
  END AS setor_atual,
  ped.numero AS pedido_numero,
  c.nome_fantasia AS cliente_nome,
  op.prazo_interno::text AS prazo_interno,
  CASE
    WHEN op.prazo_interno IS NOT NULL AND op.prazo_interno < CURRENT_DATE
      AND op.status NOT IN ('finalizado', 'cancelado')
    THEN true
    ELSE false
  END AS atrasada,
  CASE
    WHEN op.prazo_interno IS NOT NULL
    THEN (op.prazo_interno - CURRENT_DATE)
    ELSE 999
  END AS dias_restantes,
  op.data_inicio::text AS data_inicio_prevista,
  op.prazo_interno::text AS data_fim_prevista,
  op.tempo_estimado_min
FROM ordens_producao op
LEFT JOIN pedidos ped ON ped.id = op.pedido_id
LEFT JOIN clientes c ON c.id = ped.cliente_id
WHERE op.status NOT IN ('finalizado', 'cancelado')
ORDER BY
  CASE WHEN op.prazo_interno IS NOT NULL AND op.prazo_interno < CURRENT_DATE THEN 0 ELSE 1 END,
  COALESCE(op.prioridade, 0) DESC,
  op.prazo_interno ASC NULLS LAST;

-- ═══════════════════════════════════════════════════
-- PARTE 9: Grants para anon (views precisam ser visíveis via RLS)
-- ═══════════════════════════════════════════════════

GRANT SELECT ON vw_cockpit_executivo TO authenticated;
GRANT SELECT ON vw_cockpit_timeline TO authenticated;
GRANT SELECT ON vw_automacao_cobrancas TO authenticated;
GRANT SELECT ON vw_automacao_rules_status TO authenticated;
GRANT SELECT ON vw_fila_producao TO authenticated;
