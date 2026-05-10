-- Migration 154: view consolidada de engajamento de email por lead
-- Pivota email_events por agent_message_id. Mostra timestamps de cada estagio
-- (sent/delivered/opened/clicked/bounced) + ultimo evento + status.

CREATE OR REPLACE VIEW public.vw_email_engajamento_leads AS
SELECT
  l.id AS lead_id,
  l.empresa,
  l.contato_nome,
  l.contato_email,
  am.id AS message_id,
  am.assunto,
  am.created_at AS data_envio,
  am.enviado_em,
  am.delivery_status,
  am.metadata->>'resend_id' AS resend_id,
  MAX(CASE WHEN ee.event_type = 'email.delivered' THEN ee.occurred_at END) AS entregue_em,
  MAX(CASE WHEN ee.event_type = 'email.opened'    THEN ee.occurred_at END) AS abriu_em,
  MAX(CASE WHEN ee.event_type = 'email.clicked'   THEN ee.occurred_at END) AS clicou_em,
  MAX(CASE WHEN ee.event_type = 'email.bounced'   THEN ee.occurred_at END) AS bounced_em,
  MAX(CASE WHEN ee.event_type = 'email.complained' THEN ee.occurred_at END) AS reclamado_em,
  COUNT(*) FILTER (WHERE ee.event_type = 'email.opened') AS qtd_opens,
  COUNT(*) FILTER (WHERE ee.event_type = 'email.clicked') AS qtd_clicks,
  MAX(ee.occurred_at) AS ultimo_evento_em,
  (SELECT ee2.event_type FROM public.email_events ee2
    WHERE ee2.agent_message_id = am.id
    ORDER BY ee2.occurred_at DESC LIMIT 1) AS ultimo_evento_tipo,
  am.metadata->>'campanha' AS campanha,
  am.metadata->>'template_id' AS template_id
FROM public.agent_messages am
JOIN public.agent_conversations ac ON ac.id = am.conversation_id
JOIN public.leads l ON l.id = ac.lead_id
LEFT JOIN public.email_events ee ON ee.agent_message_id = am.id
WHERE am.canal = 'email'
GROUP BY l.id, l.empresa, l.contato_nome, l.contato_email,
         am.id, am.assunto, am.created_at, am.enviado_em, am.delivery_status, am.metadata;

COMMENT ON VIEW public.vw_email_engajamento_leads IS
'Pivota email_events por mensagem. Cada linha = 1 mensagem com timestamps de sent/delivered/opened/clicked/bounced + qtd_opens/qtd_clicks + ultimo evento.';
