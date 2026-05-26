-- 20260526_portal_mensagens_rpcs.sql
-- FASE 2-E — RPCs para listar e inserir mensagens no chat persistido do portal /p/:token.
-- Ambas SECURITY DEFINER. portal_inserir_mensagem fixa remetente='cliente'.
-- Mensagens de 'vendedor' e 'ia' devem ser inseridas via service_role (Edge Functions).

CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_proposta_id UUID;
  v_result JSON;
BEGIN
  SELECT p.id INTO v_proposta_id
  FROM public.propostas p
  WHERE p.share_token = p_token::uuid
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada ou link expirado';
  END IF;

  SELECT COALESCE(json_agg(json_build_object(
    'id', m.id,
    'remetente', m.remetente,
    'conteudo', m.conteudo,
    'metadata', m.metadata,
    'created_at', m.created_at
  ) ORDER BY m.created_at), '[]'::json)
  INTO v_result
  FROM public.portal_mensagens m
  WHERE m.proposta_id = v_proposta_id;

  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_inserir_mensagem(p_token text, p_conteudo text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_proposta_id UUID;
  v_msg_id UUID;
BEGIN
  -- Valida token e busca proposta
  SELECT p.id INTO v_proposta_id
  FROM public.propostas p
  WHERE p.share_token = p_token::uuid
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada ou link expirado';
  END IF;

  IF p_conteudo IS NULL OR length(trim(p_conteudo)) = 0 THEN
    RAISE EXCEPTION 'Conteudo nao pode ser vazio';
  END IF;

  IF length(p_conteudo) > 4000 THEN
    RAISE EXCEPTION 'Conteudo excede 4000 caracteres';
  END IF;

  INSERT INTO public.portal_mensagens (proposta_id, remetente, conteudo, metadata)
  VALUES (v_proposta_id, 'cliente', p_conteudo, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_msg_id;

  RETURN json_build_object('id', v_msg_id, 'proposta_id', v_proposta_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.portal_listar_mensagens(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_inserir_mensagem(text, text, jsonb) TO anon, authenticated;
