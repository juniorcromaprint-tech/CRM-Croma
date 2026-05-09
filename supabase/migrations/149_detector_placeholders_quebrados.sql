-- Migration 149: detector de placeholders quebrados em mensagens de email
--
-- Bugfix retroativo dos 44 emails enviados em 08-09/05 com {{contato_nome}} literal.
-- agent-enviar-email v24 ja faz a guarda em runtime; esta funcao serve pra varredura
-- batch / dashboards / debugging.
--
-- Uso:
--   SELECT * FROM public.fn_detect_broken_placeholders();        -- ultimas 24h
--   SELECT * FROM public.fn_detect_broken_placeholders(168);     -- ultimos 7 dias

CREATE OR REPLACE FUNCTION public.fn_detect_broken_placeholders(
  p_horas integer DEFAULT 24
)
RETURNS TABLE(
  message_id uuid,
  conversation_id uuid,
  status text,
  enviado_em timestamptz,
  to_lead text,
  assunto text,
  placeholders_no_assunto text[],
  placeholders_no_conteudo text[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT
    am.id AS message_id,
    am.conversation_id,
    am.status,
    am.enviado_em,
    l.empresa AS to_lead,
    am.assunto,
    ARRAY(SELECT (regexp_matches(am.assunto, '\{\{([a-z_]+)\}\}', 'g'))[1]) AS placeholders_no_assunto,
    ARRAY(SELECT (regexp_matches(am.conteudo, '\{\{([a-z_]+)\}\}', 'g'))[1]) AS placeholders_no_conteudo
  FROM public.agent_messages am
  LEFT JOIN public.agent_conversations ac ON ac.id = am.conversation_id
  LEFT JOIN public.leads l ON l.id = ac.lead_id
  WHERE am.canal = 'email'
    AND (am.created_at > now() - (p_horas || ' hours')::interval OR am.enviado_em > now() - (p_horas || ' hours')::interval)
    AND (am.assunto LIKE '%{{%' OR am.conteudo LIKE '%{{%')
  ORDER BY am.enviado_em DESC NULLS LAST;
$$;

COMMENT ON FUNCTION public.fn_detect_broken_placeholders(integer) IS
'Audita mensagens de email com placeholders {{var}} nao renderizados nas ultimas N horas. Util pra varredura batch e healthchecks. agent-enviar-email v24 ja bloqueia em runtime, esta funcao serve pra encontrar legados ou debug.';
