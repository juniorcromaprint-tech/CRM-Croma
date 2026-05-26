-- 20260526_portal_aprovar_proposta_v2_assinatura.sql
-- FASE 2-F — V2 da RPC de aprovacao final. Acrescenta p_assinatura_url opcional.
-- Mantem todo fluxo legado: marca aprovado_pelo_cliente, gera pedido +
-- pedido_itens, notifica vendedor. Assinatura quando presente eh armazenada em
-- propostas.assinatura_cliente_url/at e mencionada na observacao do pedido.
--
-- A versao v1 legacy (com p_nome/p_email/p_mensagem) eh dropada por migration
-- separada (drop_portal_aprovar_proposta_v1_legacy).

CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token uuid,
  p_comentario text DEFAULT NULL::text,
  p_assinatura_url text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_proposta_id  UUID;
  v_proposta     RECORD;
  v_pedido_id    UUID;
  v_item         RECORD;
  v_data_br      TEXT;
BEGIN
  SELECT id INTO v_proposta_id
  FROM propostas
  WHERE share_token        = p_token
    AND share_token_active = true
    AND aprovado_pelo_cliente = false
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada, ja aprovada, ou link expirado';
  END IF;

  UPDATE propostas SET
    aprovado_pelo_cliente    = true,
    aprovado_pelo_cliente_at = now(),
    comentario_cliente       = p_comentario,
    ip_aprovacao             = inet_client_addr(),
    status                   = 'aprovada',
    assinatura_cliente_url   = COALESCE(p_assinatura_url, assinatura_cliente_url),
    assinatura_cliente_at    = CASE WHEN p_assinatura_url IS NOT NULL THEN now() ELSE assinatura_cliente_at END,
    updated_at               = now()
  WHERE id = v_proposta_id;

  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT
    p.vendedor_id,
    'aprovacao_cliente',
    'Cliente aprovou orcamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentarios') ||
      CASE WHEN p_assinatura_url IS NOT NULL THEN ' (com assinatura digital)' ELSE '' END,
    'proposta',
    v_proposta_id
  FROM propostas p
  WHERE p.id = v_proposta_id
    AND p.vendedor_id IS NOT NULL;

  SELECT * INTO v_proposta FROM propostas WHERE id = v_proposta_id;
  v_data_br := TO_CHAR(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');

  INSERT INTO pedidos (
    proposta_id, cliente_id, vendedor_id, valor_total, status, observacoes
  ) VALUES (
    v_proposta_id,
    v_proposta.cliente_id,
    v_proposta.vendedor_id,
    COALESCE(v_proposta.total, 0),
    'aguardando_aprovacao',
    'Pedido gerado automaticamente via aprovacao no portal em ' || v_data_br ||
    CASE WHEN p_comentario IS NOT NULL THEN E'\nComentario do cliente: ' || p_comentario ELSE '' END ||
    CASE WHEN p_assinatura_url IS NOT NULL THEN E'\nAssinatura digital capturada no portal.' ELSE '' END
  )
  RETURNING id INTO v_pedido_id;

  FOR v_item IN
    SELECT * FROM proposta_itens WHERE proposta_id = v_proposta_id ORDER BY ordem
  LOOP
    INSERT INTO pedido_itens (
      pedido_id, proposta_item_id, produto_id, descricao, especificacao,
      quantidade, unidade, valor_unitario, valor_total
    ) VALUES (
      v_pedido_id, v_item.id, v_item.produto_id, v_item.descricao, v_item.especificacao,
      v_item.quantidade, COALESCE(v_item.unidade, 'un'), v_item.valor_unitario, v_item.valor_total
    );
  END LOOP;

  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT
    p.vendedor_id, 'pedido_gerado',
    'Pedido gerado a partir da proposta ' || p.numero,
    'Acesse o modulo de Pedidos para dar continuidade.',
    'pedido', v_pedido_id
  FROM propostas p
  WHERE p.id = v_proposta_id AND p.vendedor_id IS NOT NULL;

  RETURN jsonb_build_object(
    'aprovada', true,
    'pedido_id', v_pedido_id,
    'assinatura_capturada', p_assinatura_url IS NOT NULL
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$function$;

-- Drop assinatura legada incompativel (p_nome/p_email/p_mensagem)
DROP FUNCTION IF EXISTS public.portal_aprovar_proposta(uuid, text, text, text);

GRANT EXECUTE ON FUNCTION public.portal_aprovar_proposta(uuid, text, text) TO anon, authenticated;
