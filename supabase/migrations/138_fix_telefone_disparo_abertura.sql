-- ============================================================================
-- 138 — Fix telefone hardcoded em fn_disparar_abertura_em_massa
-- ============================================================================
-- Bug: ambos os overloads (5 args legacy e 6 args com p_incluir_imagem) usavam
-- '(11) 4200-3724' (numero antigo/errado) na substituicao de {{telefone_empresa}}
-- ao construir os template_params enviados ao Meta WhatsApp / email.
--
-- Fix: substituir por '(11) 3399-4517' (numero oficial Croma Print).
--
-- Observacao: foi tambem corrigida a mesma string em
-- src/domains/comercial/components/leads/DispararAberturaModal.tsx (preview UI).
-- ============================================================================

DROP FUNCTION IF EXISTS public.fn_disparar_abertura_em_massa(uuid[], uuid, uuid, boolean, text);
DROP FUNCTION IF EXISTS public.fn_disparar_abertura_em_massa(uuid[], uuid, uuid, boolean, text, boolean);

-- ─── Overload 1: 5 args (legacy) ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_disparar_abertura_em_massa(
  p_lead_ids    uuid[],
  p_template_id uuid,
  p_user_id     uuid,
  p_auto_aprovar boolean DEFAULT true,
  p_modo        text DEFAULT 'agendado'
)
RETURNS TABLE(lead_id uuid, conversation_id uuid, message_id uuid, status text, motivo text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_template       record;
  v_lead           record;
  v_conv_id        uuid;
  v_msg_id         uuid;
  v_canal          text;
  v_etapa          text;
  v_meta_name      text;
  v_template_lang  text;
  v_template_params text[];
  v_params_render  text[];
  v_param_name     text;
  v_assunto        text;
  v_lead_email     text;
BEGIN
  SELECT t.id, t.canal, t.etapa, t.conteudo, t.variaveis,
         t.meta_template_name, t.template_language, t.ativo, t.assunto, t.imagem_url
    INTO v_template
  FROM public.agent_templates t
  WHERE t.id = p_template_id;

  IF NOT FOUND OR NOT v_template.ativo THEN
    RAISE EXCEPTION 'Template % nao encontrado ou inativo', p_template_id;
  END IF;

  v_canal           := v_template.canal;
  v_etapa           := v_template.etapa;
  v_meta_name       := COALESCE(v_template.meta_template_name, 'croma_abertura');
  v_template_lang   := COALESCE(v_template.template_language, 'pt_BR');
  v_template_params := COALESCE(v_template.variaveis, ARRAY['contato_nome']);

  FOR v_lead IN
    SELECT l.id, l.empresa, l.contato_nome, l.contato_telefone, l.contato_email,
           l.email, l.observacoes, l.status AS lead_status
    FROM public.leads l
    WHERE l.id = ANY(p_lead_ids)
      AND l.excluido_em IS NULL
  LOOP
    IF v_lead.observacoes ILIKE '%NAO INCLUIR%'
       OR v_lead.observacoes ILIKE '%NÃO INCLUIR%' THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'bloqueado'; motivo := 'Lead marcado como NAO INCLUIR EM DISPAROS';
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_canal = 'whatsapp' AND (
      v_lead.contato_telefone IS NULL
      OR length(regexp_replace(v_lead.contato_telefone, '\D', '', 'g')) NOT BETWEEN 10 AND 13
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem telefone valido para WhatsApp';
      RETURN NEXT; CONTINUE;
    END IF;

    v_lead_email := COALESCE(NULLIF(TRIM(v_lead.contato_email), ''), NULLIF(TRIM(v_lead.email), ''));

    IF v_canal = 'email' AND (
      v_lead_email IS NULL OR v_lead_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem email valido';
      RETURN NEXT; CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.agent_conversations ac
      WHERE ac.lead_id = v_lead.id AND ac.status = 'ativa'
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'duplicado'; motivo := 'Lead ja tem conversa ativa';
      RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO public.agent_conversations AS ac (
      lead_id, canal, status, etapa,
      mensagens_enviadas, mensagens_recebidas,
      tentativas, max_tentativas, score_engajamento,
      automacao_pausada, auto_aprovacao, metadata
    ) VALUES (
      v_lead.id, v_canal, 'ativa', v_etapa,
      0, 0, 0, 3, 0, false, p_auto_aprovar,
      jsonb_build_object(
        'campanha', 'disparo_manual',
        'template_id', p_template_id,
        'criada_por', p_user_id,
        'criada_em', now(),
        'modo', p_modo
      )
    )
    RETURNING ac.id INTO v_conv_id;

    v_params_render := ARRAY[]::text[];
    FOREACH v_param_name IN ARRAY v_template_params LOOP
      v_params_render := v_params_render || CASE v_param_name
        WHEN 'contato_nome' THEN COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente')
        WHEN 'empresa' THEN COALESCE(v_lead.empresa, '')
        WHEN 'nome_remetente' THEN 'Junior - Croma Print'
        WHEN 'telefone_empresa' THEN '(11) 3399-4517'
        ELSE ''
      END;
    END LOOP;

    v_assunto := NULL;
    IF v_canal = 'email' AND v_template.assunto IS NOT NULL THEN
      v_assunto := v_template.assunto;
      v_assunto := REPLACE(v_assunto, '{{contato_nome}}', COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente'));
      v_assunto := REPLACE(v_assunto, '{{empresa}}', COALESCE(v_lead.empresa, ''));
    END IF;

    INSERT INTO public.agent_messages AS am (
      conversation_id, direcao, canal, conteudo, assunto, status, metadata, created_at
    ) VALUES (
      v_conv_id, 'enviada', v_canal, v_template.conteudo, v_assunto, 'aprovada',
      jsonb_build_object(
        'template_name', v_meta_name,
        'template_params', v_params_render,
        'template_language', v_template_lang,
        'template_id', p_template_id,
        'campanha', 'disparo_manual',
        'criada_por', p_user_id,
        'imagem_url', COALESCE(v_template.imagem_url, '')
      ),
      now()
    )
    RETURNING am.id INTO v_msg_id;

    UPDATE public.agent_templates t
       SET vezes_usado = COALESCE(t.vezes_usado, 0) + 1
     WHERE t.id = p_template_id;

    lead_id := v_lead.id; conversation_id := v_conv_id; message_id := v_msg_id;
    status := 'criado'; motivo := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- ─── Overload 2: 6 args (com p_incluir_imagem) — usado pelo frontend atual ─
CREATE OR REPLACE FUNCTION public.fn_disparar_abertura_em_massa(
  p_lead_ids    uuid[],
  p_template_id uuid,
  p_user_id     uuid,
  p_auto_aprovar boolean,
  p_modo        text,
  p_incluir_imagem boolean
)
RETURNS TABLE(lead_id uuid, conversation_id uuid, message_id uuid, status text, motivo text)
LANGUAGE plpgsql
AS $$
DECLARE
  v_template       record;
  v_lead           record;
  v_conv_id        uuid;
  v_msg_id         uuid;
  v_canal          text;
  v_etapa          text;
  v_meta_name      text;
  v_template_lang  text;
  v_template_params text[];
  v_params_render  text[];
  v_param_name     text;
  v_assunto        text;
  v_lead_email     text;
  v_imagem_url     text;
BEGIN
  SELECT t.id, t.canal, t.etapa, t.conteudo, t.variaveis,
         t.meta_template_name, t.template_language, t.ativo, t.assunto, t.imagem_url
    INTO v_template
  FROM public.agent_templates t
  WHERE t.id = p_template_id;

  IF NOT FOUND OR NOT v_template.ativo THEN
    RAISE EXCEPTION 'Template % nao encontrado ou inativo', p_template_id;
  END IF;

  v_canal           := v_template.canal;
  v_etapa           := v_template.etapa;
  v_meta_name       := COALESCE(v_template.meta_template_name, 'croma_abertura');
  v_template_lang   := COALESCE(v_template.template_language, 'pt_BR');
  v_template_params := COALESCE(v_template.variaveis, ARRAY['contato_nome']);

  v_imagem_url := CASE WHEN p_incluir_imagem THEN COALESCE(v_template.imagem_url, '') ELSE '' END;

  FOR v_lead IN
    SELECT l.id, l.empresa, l.contato_nome, l.contato_telefone, l.contato_email,
           l.email, l.observacoes, l.status AS lead_status
    FROM public.leads l
    WHERE l.id = ANY(p_lead_ids)
      AND l.excluido_em IS NULL
  LOOP
    IF v_lead.observacoes ILIKE '%NAO INCLUIR%'
       OR v_lead.observacoes ILIKE '%NÃO INCLUIR%' THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'bloqueado'; motivo := 'Lead marcado como NAO INCLUIR EM DISPAROS';
      RETURN NEXT; CONTINUE;
    END IF;

    IF v_canal = 'whatsapp' AND (
      v_lead.contato_telefone IS NULL
      OR length(regexp_replace(v_lead.contato_telefone, '\D', '', 'g')) NOT BETWEEN 10 AND 13
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem telefone valido para WhatsApp';
      RETURN NEXT; CONTINUE;
    END IF;

    v_lead_email := COALESCE(NULLIF(TRIM(v_lead.contato_email), ''), NULLIF(TRIM(v_lead.email), ''));

    IF v_canal = 'email' AND (
      v_lead_email IS NULL OR v_lead_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'pulado'; motivo := 'Lead sem email valido';
      RETURN NEXT; CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.agent_conversations ac
      WHERE ac.lead_id = v_lead.id AND ac.status = 'ativa'
    ) THEN
      lead_id := v_lead.id; conversation_id := NULL; message_id := NULL;
      status := 'duplicado'; motivo := 'Lead ja tem conversa ativa';
      RETURN NEXT; CONTINUE;
    END IF;

    INSERT INTO public.agent_conversations AS ac (
      lead_id, canal, status, etapa,
      mensagens_enviadas, mensagens_recebidas,
      tentativas, max_tentativas, score_engajamento,
      automacao_pausada, auto_aprovacao, metadata
    ) VALUES (
      v_lead.id, v_canal, 'ativa', v_etapa,
      0, 0, 0, 3, 0, false, p_auto_aprovar,
      jsonb_build_object(
        'campanha', 'disparo_manual',
        'template_id', p_template_id,
        'criada_por', p_user_id,
        'criada_em', now(),
        'modo', p_modo
      )
    )
    RETURNING ac.id INTO v_conv_id;

    v_params_render := ARRAY[]::text[];
    FOREACH v_param_name IN ARRAY v_template_params LOOP
      v_params_render := v_params_render || CASE v_param_name
        WHEN 'contato_nome' THEN COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente')
        WHEN 'empresa' THEN COALESCE(v_lead.empresa, '')
        WHEN 'nome_remetente' THEN 'Junior - Croma Print'
        WHEN 'telefone_empresa' THEN '(11) 3399-4517'
        ELSE ''
      END;
    END LOOP;

    v_assunto := NULL;
    IF v_canal = 'email' AND v_template.assunto IS NOT NULL THEN
      v_assunto := v_template.assunto;
      v_assunto := REPLACE(v_assunto, '{{contato_nome}}', COALESCE(v_lead.contato_nome, v_lead.empresa, 'Cliente'));
      v_assunto := REPLACE(v_assunto, '{{empresa}}', COALESCE(v_lead.empresa, ''));
    END IF;

    INSERT INTO public.agent_messages AS am (
      conversation_id, direcao, canal, conteudo, assunto, status, metadata, created_at
    ) VALUES (
      v_conv_id, 'enviada', v_canal, v_template.conteudo, v_assunto, 'aprovada',
      jsonb_build_object(
        'template_name', v_meta_name,
        'template_params', v_params_render,
        'template_language', v_template_lang,
        'template_id', p_template_id,
        'campanha', 'disparo_manual',
        'criada_por', p_user_id,
        'imagem_url', v_imagem_url
      ),
      now()
    )
    RETURNING am.id INTO v_msg_id;

    UPDATE public.agent_templates t
       SET vezes_usado = COALESCE(t.vezes_usado, 0) + 1
     WHERE t.id = p_template_id;

    lead_id := v_lead.id; conversation_id := v_conv_id; message_id := v_msg_id;
    status := 'criado'; motivo := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;
