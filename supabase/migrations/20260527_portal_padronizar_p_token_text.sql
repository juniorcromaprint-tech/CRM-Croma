-- 20260527_portal_padronizar_p_token_text.sql
--
-- Padroniza p_token como TEXT em portal_aprovar_item e portal_aprovar_proposta,
-- alinhando com as demais RPCs do portal (portal_get_proposta, portal_atualizar_cliente,
-- portal_inserir_mensagem, portal_listar_mensagens) que ja usam TEXT.
--
-- Frontend (portal.service.ts: aprovarItem, aprovarProposta) ja passa string nativa,
-- entao a mudanca eh zero-impact para os callers atuais.
--
-- Cast p_token::uuid eh aplicado no WHERE share_token = ... (share_token continua uuid).
-- Idempotente: DROP IF EXISTS antes do CREATE OR REPLACE.

BEGIN;

-- ─── portal_aprovar_item ────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.portal_aprovar_item(uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.portal_aprovar_item(
  p_token   TEXT,
  p_item_id uuid,
  p_aprovado boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proposta_id uuid;
  v_status_atual text;
  v_total_itens int;
  v_aprovados int;
  v_recusados int;
  v_pendentes int;
  v_novo_status text;
BEGIN
  -- Resolve token -> proposta_id
  SELECT id, status
    INTO v_proposta_id, v_status_atual
    FROM propostas
   WHERE share_token = p_token::uuid;

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token invalido' USING ERRCODE = 'P0001';
  END IF;

  -- Bloquear alteracao quando proposta ja esta convertida em pedido
  IF v_status_atual IN ('convertida', 'recusada', 'expirada') THEN
    RAISE EXCEPTION 'Proposta % nao aceita mais alteracoes', v_status_atual USING ERRCODE = 'P0001';
  END IF;

  -- Atualiza o item (garantindo vinculo com a proposta do token)
  UPDATE proposta_itens
     SET aprovado = p_aprovado
   WHERE id = p_item_id
     AND proposta_id = v_proposta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao pertence a esta proposta' USING ERRCODE = 'P0001';
  END IF;

  -- Recalcular agregados (so itens visiveis contam — espelha PortalItemList)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE aprovado IS TRUE),
    COUNT(*) FILTER (WHERE aprovado IS FALSE),
    COUNT(*) FILTER (WHERE aprovado IS NULL)
  INTO v_total_itens, v_aprovados, v_recusados, v_pendentes
  FROM proposta_itens
  WHERE proposta_id = v_proposta_id
    AND (item_visivel IS NULL OR item_visivel = TRUE);

  -- Regras de status:
  --  - todos aprovados -> aprovada_cliente
  --  - alguns escolhidos (aprovados ou recusados) E ainda ha pendentes/recusados -> aprovacao_parcial
  --  - nenhuma decisao ainda -> mantem status atual (NULL aqui)
  IF v_total_itens > 0 AND v_aprovados = v_total_itens THEN
    v_novo_status := 'aprovada_cliente';
  ELSIF (v_aprovados > 0 OR v_recusados > 0) THEN
    v_novo_status := 'aprovacao_parcial';
  ELSE
    v_novo_status := NULL;
  END IF;

  IF v_novo_status IS NOT NULL
     AND v_status_atual NOT IN ('aprovada','convertida','recusada','expirada') THEN
    UPDATE propostas
       SET status = v_novo_status
     WHERE id = v_proposta_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'proposta_id', v_proposta_id,
    'item_id', p_item_id,
    'aprovado', p_aprovado,
    'novo_status', COALESCE(v_novo_status, v_status_atual),
    'total_itens', v_total_itens,
    'aprovados', v_aprovados,
    'recusados', v_recusados,
    'pendentes', v_pendentes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.portal_aprovar_item(TEXT, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_item(TEXT, uuid, boolean)
  TO anon, authenticated, service_role;

-- ─── portal_aprovar_proposta ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.portal_aprovar_proposta(uuid, text, text);

CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token          TEXT,
  p_comentario     text DEFAULT NULL,
  p_assinatura_url text DEFAULT NULL
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
  WHERE share_token        = p_token::uuid
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

REVOKE ALL ON FUNCTION public.portal_aprovar_proposta(TEXT, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_aprovar_proposta(TEXT, text, text)
  TO anon, authenticated, service_role;

COMMIT;
