-- Migration 153: fix migration 152 - column "status" was ambiguous
-- between RETURNS TABLE column and agent_messages.status
-- Adicionado #variable_conflict use_column + qualificadores explicitos.

CREATE OR REPLACE FUNCTION public.fn_preflight_email_campaign(
  p_lead_ids uuid[],
  p_template_id uuid
)
RETURNS TABLE(
  check_name text,
  status text,
  total_afetados integer,
  detalhe text,
  exemplos text[]
)
LANGUAGE plpgsql STABLE
AS $$
#variable_conflict use_column
DECLARE
  v_template record;
  v_max_dia integer := 200;
  v_enviadas_hoje integer := 0;
BEGIN
  SELECT id, conteudo, assunto, ativo INTO v_template
  FROM public.agent_templates WHERE id = p_template_id;

  SELECT (valor::jsonb->>'max_emails_dia')::int INTO v_max_dia
  FROM public.admin_config WHERE chave = 'agent_config';
  v_max_dia := COALESCE(v_max_dia, 200);

  SELECT COUNT(*) INTO v_enviadas_hoje
  FROM public.agent_messages am
  WHERE am.canal = 'email' AND am.status = 'enviada'
    AND am.enviado_em >= date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo';

  RETURN QUERY SELECT 'template_existe_ativo'::text,
    CASE WHEN v_template.id IS NOT NULL AND v_template.ativo THEN 'PASS' ELSE 'FAIL' END,
    1,
    CASE WHEN v_template.id IS NULL THEN 'Template nao encontrado'
         WHEN NOT v_template.ativo THEN 'Template existe mas esta inativo' ELSE 'OK' END,
    NULL::text[];

  RETURN QUERY
  WITH placeholders_no_template AS (
    SELECT DISTINCT (regexp_matches(COALESCE(v_template.conteudo,'') || ' ' || COALESCE(v_template.assunto,''), '\{\{([a-z_]+)\}\}', 'g'))[1] AS p
  ),
  suportados AS (
    SELECT unnest(ARRAY['saudacao','contato_nome_formatado','assinatura_nome','assinatura_empresa','contato_nome','empresa','cidade','nome_remetente','telefone_empresa']) AS p
  )
  SELECT 'placeholders_suportados'::text,
    CASE WHEN COUNT(pt.p) > 0 THEN 'FAIL' ELSE 'PASS' END,
    COUNT(pt.p)::int,
    CASE WHEN COUNT(pt.p) > 0 THEN 'Template usa placeholders nao reconhecidos: ' || string_agg(pt.p, ', ') ELSE 'OK' END,
    ARRAY_AGG(pt.p)
  FROM placeholders_no_template pt WHERE pt.p NOT IN (SELECT p FROM suportados);

  RETURN QUERY SELECT 'leads_com_nao_incluir'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' leads marcados [NAO INCLUIR]' END,
    (ARRAY_AGG(l.empresa ORDER BY l.empresa))[1:5]
  FROM public.leads l WHERE l.id = ANY(p_lead_ids)
    AND (l.observacoes ILIKE '%NAO INCLUIR%' OR l.observacoes ILIKE '%NÃO INCLUIR%');

  RETURN QUERY SELECT 'leads_sem_email_valido'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' leads sem email valido' END,
    (ARRAY_AGG(l.empresa ORDER BY l.empresa))[1:5]
  FROM public.leads l WHERE l.id = ANY(p_lead_ids)
    AND (l.contato_email IS NULL OR l.contato_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

  RETURN QUERY
  WITH bounced AS (SELECT DISTINCT to_email FROM public.email_events WHERE event_type = 'email.bounced')
  SELECT 'leads_com_bounce_anterior'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' leads ja tiveram bounce' END,
    (ARRAY_AGG(l.empresa ORDER BY l.empresa))[1:5]
  FROM public.leads l WHERE l.id = ANY(p_lead_ids) AND l.contato_email IN (SELECT to_email FROM bounced);

  RETURN QUERY
  WITH dup AS (SELECT contato_email, COUNT(*) c FROM public.leads l
    WHERE l.id = ANY(p_lead_ids) AND l.contato_email IS NOT NULL
    GROUP BY contato_email HAVING COUNT(*) > 1)
  SELECT 'emails_duplicados_na_lista'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' emails duplicados na lista' END,
    (ARRAY_AGG(contato_email))[1:5] FROM dup;

  RETURN QUERY SELECT 'leads_em_conversa_ativa'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' leads em conversa ativa' END,
    (ARRAY_AGG(l.empresa ORDER BY l.empresa))[1:5]
  FROM public.leads l JOIN public.agent_conversations ac ON ac.lead_id = l.id AND ac.status = 'ativa'
  WHERE l.id = ANY(p_lead_ids);

  RETURN QUERY SELECT 'leads_excluidos'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END, COUNT(*)::int,
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE COUNT(*) || ' leads excluidos' END, NULL::text[]
  FROM public.leads l WHERE l.id = ANY(p_lead_ids) AND l.excluido_em IS NOT NULL;

  RETURN QUERY SELECT 'respeita_limite_diario'::text,
    CASE WHEN array_length(p_lead_ids, 1) <= (v_max_dia - v_enviadas_hoje) THEN 'PASS' ELSE 'WARN' END,
    array_length(p_lead_ids, 1),
    'Limite ' || v_max_dia || ' | Hoje ' || v_enviadas_hoje || ' | Esta ' || array_length(p_lead_ids, 1)
      || ' | Restante ' || (v_max_dia - v_enviadas_hoje - array_length(p_lead_ids, 1)),
    NULL::text[];

  RETURN QUERY
  WITH bounced AS (SELECT DISTINCT to_email FROM public.email_events WHERE event_type = 'email.bounced')
  SELECT 'total_leads_elegiveis'::text,
    CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END, COUNT(*)::int,
    'Apos filtros: ' || COUNT(*) || ' leads vao receber', NULL::text[]
  FROM public.leads l WHERE l.id = ANY(p_lead_ids)
    AND l.excluido_em IS NULL
    AND l.contato_email IS NOT NULL AND l.contato_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND COALESCE(l.observacoes, '') NOT ILIKE '%NAO INCLUIR%' AND COALESCE(l.observacoes, '') NOT ILIKE '%NÃO INCLUIR%'
    AND l.contato_email NOT IN (SELECT to_email FROM bounced)
    AND NOT EXISTS (SELECT 1 FROM public.agent_conversations ac WHERE ac.lead_id = l.id AND ac.status = 'ativa');
END;
$$;
