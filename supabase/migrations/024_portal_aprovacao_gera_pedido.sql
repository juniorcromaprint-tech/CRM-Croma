-- 024_portal_aprovacao_gera_pedido.sql
-- A-18: Quando o cliente aprova a proposta no portal público,
-- o pedido de venda é gerado automaticamente em status 'aguardando_aprovacao'.
--
-- Schema real:
--   propostas  → total, cliente_id, vendedor_id, proposta_itens(*)
--   proposta_itens → produto_id, descricao, especificacao, quantidade, unidade,
--                    valor_unitario, valor_total, proposta_item_id ref (self)
--   pedidos    → proposta_id, cliente_id, vendedor_id, valor_total, status,
--                observacoes — numero é gerado automaticamente pelo trigger
--   pedido_itens → pedido_id, proposta_item_id, produto_id, descricao,
--                  especificacao, quantidade, unidade, valor_unitario, valor_total

CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token     UUID,
  p_comentario TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_proposta_id  UUID;
  v_proposta     RECORD;
  v_pedido_id    UUID;
  v_item         RECORD;
  v_data_br      TEXT;
BEGIN
  -- 1. Valida token e busca id da proposta
  SELECT id INTO v_proposta_id
  FROM propostas
  WHERE share_token        = p_token
    AND share_token_active = true
    AND aprovado_pelo_cliente = false
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada, já aprovada, ou link expirado';
  END IF;

  -- 2. Atualiza status da proposta
  UPDATE propostas SET
    aprovado_pelo_cliente    = true,
    aprovado_pelo_cliente_at = now(),
    comentario_cliente       = p_comentario,
    ip_aprovacao             = inet_client_addr(),
    status                   = 'aprovada',
    updated_at               = now()
  WHERE id = v_proposta_id;

  -- 3. Notifica o vendedor
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT
    p.vendedor_id,
    'aprovacao_cliente',
    'Cliente aprovou orçamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentários'),
    'proposta',
    v_proposta_id
  FROM propostas p
  WHERE p.id = v_proposta_id
    AND p.vendedor_id IS NOT NULL;

  -- 4. Cria pedido automaticamente
  SELECT * INTO v_proposta FROM propostas WHERE id = v_proposta_id;

  v_data_br := TO_CHAR(now() AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');

  INSERT INTO pedidos (
    proposta_id,
    cliente_id,
    vendedor_id,
    valor_total,
    status,
    observacoes
  ) VALUES (
    v_proposta_id,
    v_proposta.cliente_id,
    v_proposta.vendedor_id,
    COALESCE(v_proposta.total, 0),
    'aguardando_aprovacao',
    'Pedido gerado automaticamente via aprovação no portal em ' || v_data_br ||
    CASE WHEN p_comentario IS NOT NULL
         THEN E'\nComentário do cliente: ' || p_comentario
         ELSE ''
    END
  )
  RETURNING id INTO v_pedido_id;

  -- 5. Copia itens da proposta para o pedido
  FOR v_item IN
    SELECT * FROM proposta_itens WHERE proposta_id = v_proposta_id ORDER BY ordem
  LOOP
    INSERT INTO pedido_itens (
      pedido_id,
      proposta_item_id,
      produto_id,
      descricao,
      especificacao,
      quantidade,
      unidade,
      valor_unitario,
      valor_total
    ) VALUES (
      v_pedido_id,
      v_item.id,
      v_item.produto_id,
      v_item.descricao,
      v_item.especificacao,
      v_item.quantidade,
      COALESCE(v_item.unidade, 'un'),
      v_item.valor_unitario,
      v_item.valor_total
    );
  END LOOP;

  -- 6. Notifica o vendedor sobre o pedido criado
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT
    p.vendedor_id,
    'pedido_gerado',
    'Pedido gerado a partir da proposta ' || p.numero,
    'Acesse o módulo de Pedidos para dar continuidade.',
    'pedido',
    v_pedido_id
  FROM propostas p
  WHERE p.id = v_proposta_id
    AND p.vendedor_id IS NOT NULL;

  RETURN jsonb_build_object(
    'aprovada',   true,
    'pedido_id',  v_pedido_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Garante que a aprovação não falha silenciosamente se a criação do pedido falhar.
  -- Re-raise para o cliente tratar.
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões: apenas usuários autenticados e anon (portal público usa token, não sessão)
GRANT EXECUTE ON FUNCTION public.portal_aprovar_proposta(UUID, TEXT) TO anon, authenticated;
