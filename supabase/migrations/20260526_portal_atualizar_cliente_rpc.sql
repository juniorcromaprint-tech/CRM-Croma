-- 20260526_portal_atualizar_cliente_rpc.sql
-- FASE 2-C — Cliente edita seus proprios dados cadastrais pelo portal /p/:token.
-- Whitelist explicita: contato_nome (mapeia pra contato_financeiro), telefone,
-- email, endereco, numero, complemento, bairro, cidade, estado, cep.
-- NAO expoe cnpj/razao_social (dados fiscais imutaveis pelo portal).

CREATE OR REPLACE FUNCTION public.portal_atualizar_cliente(p_token text, p_dados jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_proposta_id UUID;
  v_cliente_id UUID;
  v_atualizados JSONB := '{}'::jsonb;
BEGIN
  SELECT p.id, p.cliente_id INTO v_proposta_id, v_cliente_id
  FROM propostas p
  WHERE p.share_token = p_token::uuid
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token invalido ou expirado';
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Proposta sem cliente vinculado';
  END IF;

  UPDATE clientes
  SET
    contato_financeiro = COALESCE(p_dados->>'contato_nome', contato_financeiro),
    telefone           = COALESCE(p_dados->>'telefone', telefone),
    email              = COALESCE(p_dados->>'email', email),
    endereco           = COALESCE(p_dados->>'endereco', endereco),
    numero             = COALESCE(p_dados->>'numero', numero),
    complemento        = COALESCE(p_dados->>'complemento', complemento),
    bairro             = COALESCE(p_dados->>'bairro', bairro),
    cidade             = COALESCE(p_dados->>'cidade', cidade),
    estado             = COALESCE(p_dados->>'estado', estado),
    cep                = COALESCE(p_dados->>'cep', cep),
    updated_at         = now()
  WHERE id = v_cliente_id
  RETURNING jsonb_build_object(
    'contato_nome', contato_financeiro,
    'telefone',     telefone,
    'email',        email,
    'endereco',     endereco,
    'numero',       numero,
    'complemento',  complemento,
    'bairro',       bairro,
    'cidade',       cidade,
    'estado',       estado,
    'cep',          cep
  ) INTO v_atualizados;

  RETURN jsonb_build_object(
    'ok', true,
    'cliente_id', v_cliente_id,
    'proposta_id', v_proposta_id,
    'dados', v_atualizados
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.portal_atualizar_cliente(text, jsonb) TO anon, authenticated;
