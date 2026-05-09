-- Migration 148: corrige fn_disparar_abertura_em_massa para respeitar p_auto_aprovar
--
-- Bugs encontrados em 2026-05-09 ao testar disparo manual via UI (sessao Cowork):
-- 1) Funcao criava mensagem sempre como status='aprovada' independente de p_auto_aprovar
-- 2) Funcao nunca preenchia aprovado_em nem aprovado_por (audit gap)
--
-- Comportamento corrigido:
-- - p_auto_aprovar = true  -> status='aprovada', aprovado_em=now(), aprovado_por=p_user_id
-- - p_auto_aprovar = false -> status='pendente_aprovacao', aprovado_em=null, aprovado_por=null
--
-- O dispatch (dispatch-approved-messages) continua filtrando por status='aprovada', entao
-- mensagens com p_auto_aprovar=true continuam entrando direto na fila do cron.
-- Mensagens com p_auto_aprovar=false ficam aguardando workflow de aprovacao humana.
--
-- O wrapper SQL de 6 args (sem p_campanha_id) nao precisa de mudanca - delega para esta versao.
-- O legado de 5 args (migration 138) tambem nao precisa - nada o invoca atualmente.

CREATE OR REPLACE FUNCTION public.fn_disparar_abertura_em_massa(
  p_lead_ids uuid[],
  p_template_id uuid,
  p_user_id uuid,
  p_auto_aprovar boolean,
  p_modo text,
  p_incluir_imagem boolean,
  p_campanha_id uuid
)
RETURNS TABLE(lead_id uuid, conversation_id uuid, message_id uuid, status text, motivo text)
LANGUAGE plpgsql
AS $function$
#variable_conflict use_column
DECLARE
  v_template          record;
  v_lead              record;
  v_conv_id           uuid;
  v_msg_id            uuid;
  v_canal             text;
  v_etapa             text;
  v_meta_name         text;
  v_template_lang     text;
  v_template_params   text[];
  v_params_render     text[];
  v_param_name        text;
  v_assunto           text;
  v_lead_email        text;
  v_imagem_url        text;
  v_camp_status       text;
  v_camp_canal        text;
  v_contador_criados  integer := 0;
  -- FIX 2026-05-09: variaveis derivadas de p_auto_aprovar
  v_msg_status        text;
  v_aprovado_em       timestamptz;
  v_aprovado_por      uuid;
BEGIN
  -- FIX 2026-05-09: respeitar p_auto_aprovar
  IF p_auto_aprovar THEN
    v_msg_status   := 'aprovada';
    v_aprovado_em  := now();
    v_aprovado_por := p_user_id;
  ELSE
    v_msg_status   := 'pendente_aprovacao';
    v_aprovado_em  := NULL;
    v_aprovado_por := NULL;
  END IF;

  SELECT t.id, t.canal, t.etapa, t.conteudo, t.variaveis,
         t.meta_template_name, t.template_language, t.ativo, t.assunto, t.imagem_url
    INTO v_template FROM public.agent_templates t WHERE t.id = p_template_id;

  IF NOT FOUND OR NOT v_template.ativo THEN
    RAISE EXCEPTION 'Template % nao encontrado ou inativo', p_template_id;
  END IF;

  v_canal := v_template.canal; v_etapa := v_template.etapa;
  v_meta_name := COALESCE(v_template.meta_template_name, 'croma_abertura');
  v_template_lang := COALESCE(v_template.template_language, 'pt_BR');
  v_template_params := COALESCE(v_template.variaveis, ARRAY['contato_nome']);
  v_imagem_url := CASE WHEN p_incluir_imagem THEN COALESCE(v_template.imagem_url, '') ELSE '' END;

  IF p_campanha_id IS NOT NULL THEN
    SELECT c.status, c.canal INTO v_camp_status, v_camp_canal
    FROM public.agent_campanhas c WHERE c.id = p_campanha_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Campanha % nao encontrada', p_campanha_id; END IF;
    IF v_camp_status NOT IN ('rascunho', 'ativa') THEN
      RAISE EXCEPTION 'Campanha % esta com status "%" e nao aceita novos disparos. Para retomar, mude o status para "ativa".', p_campanha_id, v_camp_status;
    END IF;
    IF v_camp_canal <> 'misto' AND v_camp_canal <> v_canal THEN
      RAISE EXCEPTION 'Campanha % e do canal "%" e o template e do canal "%". Use uma campanha "misto" ou um template do canal correto.', p_campanha_id, v_camp_canal, v_canal;
    END IF;
  END IF;

  FOR v_lead IN
    SELECT l.id, l.empresa, l.contato_nome, l.contato_telefone, l.contato_email,
           l.email, l.observacoes, l.status AS lead_status
    FROM public.leads l WHERE l.id = ANY(p_lead_ids) AND l.excluido_em IS NULL
  LOOP
    IF v_lead.observacoes ILIKE '%NAO INCLUIR%' OR v_lead.observacoes ILIKE '%NÃO INCLUIR%' THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'bloqueado'; motivo := 'Lead marcado como NAO INCLUIR EM DISPAROS';
      RETURN NEXT; CONTINUE;
    END IF;
    IF v_canal = 'whatsapp' AND (v_lead.contato_telefone IS NULL
       OR length(regexp_replace(v_lead.contato_telefone, '\D', '', 'g')) NOT BETWEEN 10 AND 13) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem telefone valido para WhatsApp';
      RETURN NEXT; CONTINUE;
    END IF;
    v_lead_email := COALESCE(NULLIF(TRIM(v_lead.contato_email), ''), NULLIF(TRIM(v_lead.email), ''));
    IF v_canal = 'email' AND (v_lead_email IS NULL OR v_lead_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem email valido';
      RETURN NEXT; CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.agent_conversations ac WHERE ac.lead_id = v_lead.id AND ac.status = 'ativa') THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'duplicado'; motivo := 'Lead ja tem conversa ativa';
      RETURN NEXT; CONTINUE;
    END IF;
    INSERT INTO public.agent_conversations (
      lead_id, canal, status, etapa, mensagens_enviadas, mensagens_recebidas,
      tentativas, max_tentativas, score_engajamento, automacao_pausada, auto_aprovacao, metadata, campanha_id
    ) VALUES (
      v_lead.id, v_canal, 'ativa', v_etapa, 0, 0, 0, 3, 0, false, p_auto_aprovar,
      jsonb_build_object('campanha','disparo_manual','template_id',p_template_id,'criada_por',p_user_id,'criada_em',now(),'modo',p_modo),
      p_campanha_id
    ) RETURNING id INTO v_conv_id;

    v_params_render := ARRAY[]::text[];
    FOREACH v_param_name IN ARRAY v_template_params LOOP
      v_params_render := v_params_render || CASE v_param_name
        WHEN 'contato_nome' THEN COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente')
        WHEN 'empresa' THEN COALESCE(v_lead.empresa, '')
        WHEN 'nome_remetente' THEN 'Junior - Croma Print'
        WHEN 'telefone_empresa' THEN '(11) 3399-4517'
        ELSE '' END;
    END LOOP;

    v_assunto := NULL;
    IF v_canal = 'email' AND v_template.assunto IS NOT NULL THEN
      v_assunto := v_template.assunto;
      v_assunto := REPLACE(v_assunto, '{{contato_nome}}', COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente'));
      v_assunto := REPLACE(v_assunto, '{{empresa}}', COALESCE(v_lead.empresa, ''));
    END IF;

    -- FIX 2026-05-09: status, aprovado_em, aprovado_por agora derivados de p_auto_aprovar
    INSERT INTO public.agent_messages (
      conversation_id, direcao, canal, conteudo, assunto, status,
      aprovado_em, aprovado_por,
      metadata, created_at, campanha_id
    ) VALUES (
      v_conv_id, 'enviada', v_canal, v_template.conteudo, v_assunto, v_msg_status,
      v_aprovado_em, v_aprovado_por,
      jsonb_build_object('template_name',v_meta_name,'template_params',v_params_render,'template_language',v_template_lang,'template_id',p_template_id,'campanha','disparo_manual','criada_por',p_user_id,'imagem_url',v_imagem_url),
      now(), p_campanha_id
    ) RETURNING id INTO v_msg_id;

    UPDATE public.agent_templates SET vezes_usado = COALESCE(vezes_usado, 0) + 1 WHERE id = p_template_id;

    v_contador_criados := v_contador_criados + 1;
    lead_id := v_lead.id; conversation_id := v_conv_id; message_id := v_msg_id;
    status := 'criado'; motivo := NULL;
    RETURN NEXT;
  END LOOP;

  IF p_campanha_id IS NOT NULL AND v_contador_criados > 0 THEN
    UPDATE public.agent_campanhas
       SET total_leads = total_leads + v_contador_criados,
           iniciada_em = COALESCE(iniciada_em, now()),
           status = CASE WHEN status = 'rascunho' THEN 'ativa' ELSE status END
     WHERE id = p_campanha_id;
  END IF;
END; $function$;

COMMENT ON FUNCTION public.fn_disparar_abertura_em_massa(uuid[], uuid, uuid, boolean, text, boolean, uuid) IS
'Cria conversa+mensagem de abertura em massa. v2 (2026-05-09): respeita p_auto_aprovar — true=>status=aprovada+aprovado_em=now()+aprovado_por=p_user_id, false=>status=pendente_aprovacao+aprovado_em=null. Bugfix do gap de auditoria do disparo manual.';
