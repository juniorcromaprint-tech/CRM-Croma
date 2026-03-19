-- supabase/migrations/073_fix_portal_pedido_custeio.sql
-- Fix: portal_aprovar_proposta agora copia campos de custeio para pedido_itens
-- Alinha com o comportamento do converterParaPedido no frontend

CREATE OR REPLACE FUNCTION portal_aprovar_proposta(
  p_token UUID,
  p_nome TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_mensagem TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_proposta RECORD;
  v_pedido_id UUID;
  v_numero TEXT;
  v_ano INT;
  v_seq INT;
BEGIN
  -- Buscar proposta pelo token
  SELECT p.*, c.razao_social as cliente_nome
  INTO v_proposta
  FROM propostas p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.token_acesso = p_token
    AND p.status IN ('enviada', 'visualizada', 'rascunho', 'aprovada');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposta não encontrada ou expirada');
  END IF;

  -- Verificar expiração
  IF v_proposta.validade IS NOT NULL AND v_proposta.validade < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Proposta expirada');
  END IF;

  -- Atualizar status da proposta
  UPDATE propostas SET
    status = 'aprovada',
    aprovado_em = NOW(),
    aprovado_por_nome = COALESCE(p_nome, 'Cliente (portal)'),
    aprovado_por_email = p_email,
    mensagem_aprovacao = p_mensagem,
    updated_at = NOW()
  WHERE id = v_proposta.id;

  -- Gerar número do pedido
  v_ano := EXTRACT(YEAR FROM NOW())::INT;
  SELECT COALESCE(MAX(
    CASE WHEN numero ~ ('^PED-' || v_ano || '-\d+$')
    THEN SUBSTRING(numero FROM 'PED-\d{4}-(\d+)')::INT
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM pedidos;

  v_numero := 'PED-' || v_ano || '-' || LPAD(v_seq::TEXT, 4, '0');

  -- Criar pedido
  v_pedido_id := gen_random_uuid();

  INSERT INTO pedidos (id, numero, proposta_id, cliente_id, vendedor_id, status, valor_total, created_at, updated_at)
  VALUES (
    v_pedido_id,
    v_numero,
    v_proposta.id,
    v_proposta.cliente_id,
    v_proposta.vendedor_id,
    'aguardando_aprovacao',
    v_proposta.total,
    NOW(),
    NOW()
  );

  -- Copiar itens COM campos de custeio (fix: antes não copiava)
  INSERT INTO pedido_itens (
    id, pedido_id, descricao, quantidade, valor_unitario, valor_total, unidade,
    modelo_id, area_m2, largura_cm, altura_cm,
    custo_mp, custo_mo, custo_fixo, markup_percentual,
    created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    v_pedido_id,
    pi.descricao,
    pi.quantidade,
    pi.valor_unitario,
    pi.valor_total,
    pi.unidade,
    pi.modelo_id,
    pi.area_m2,
    pi.largura_cm,
    pi.altura_cm,
    pi.custo_mp,
    pi.custo_mo,
    pi.custo_fixo,
    pi.markup_percentual,
    NOW(),
    NOW()
  FROM proposta_itens pi
  WHERE pi.proposta_id = v_proposta.id;

  -- Registrar tracking
  INSERT INTO proposta_views (proposta_id, evento, dados, created_at)
  VALUES (v_proposta.id, 'aprovacao_portal', jsonb_build_object(
    'nome', p_nome,
    'email', p_email,
    'mensagem', p_mensagem,
    'pedido_numero', v_numero
  ), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'pedido_id', v_pedido_id,
    'pedido_numero', v_numero
  );
END;
$$;
