-- 20260526_portal_get_proposta_with_store.sql
-- v2 da RPC publica do portal /p/:token. Acrescenta:
--   - store (loja Beira Rio do config_snapshot)
--   - referencia / prazo_entrega_dias / logistica (FASE 1)
--   - assinatura_cliente_url / assinatura_cliente_at (FASE 2-F)
--   - vendedor (id/nome/telefone/email para WhatsApp + PIX)
--   - itens.imagem_url + itens.aprovado (FASE 2-B)
-- SECURITY DEFINER — usada pelo client anon via share_token.

CREATE OR REPLACE FUNCTION public.portal_get_proposta(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'id', p.id, 'numero', p.numero, 'status', p.status,
    'valor_total', p.total, 'desconto_percentual', p.desconto_percentual,
    'forma_pagamento', p.forma_pagamento, 'parcelas_count', p.parcelas_count,
    'prazo_dias', p.prazo_dias, 'entrada_percentual', p.entrada_percentual,
    'validade', p.validade_dias, 'created_at', p.created_at,
    'observacoes', p.observacoes,
    'aprovado_pelo_cliente', p.aprovado_pelo_cliente,
    'referencia', p.referencia,
    'prazo_entrega_dias', p.prazo_entrega_dias,
    'logistica', p.logistica,
    'assinatura_cliente_url', p.assinatura_cliente_url,
    'assinatura_cliente_at', p.assinatura_cliente_at,
    'store', p.config_snapshot->'store',
    'cliente', json_build_object(
      'nome_fantasia', c.nome_fantasia,
      'razao_social', c.razao_social,
      'contato_nome', c.contato_financeiro,
      'cnpj', c.cnpj,
      'telefone', c.telefone,
      'email', c.email,
      'cidade', c.cidade,
      'estado', c.estado,
      'cep', c.cep,
      'bairro', c.bairro
    ),
    'vendedor', (
      SELECT json_build_object(
        'id', pr.id,
        'nome', pr.full_name,
        'telefone', pr.telefone,
        'email', pr.email
      ) FROM profiles pr WHERE pr.id = p.vendedor_id
    ),
    'empresa', (
      SELECT json_build_object(
        'razao_social', e.razao_social,
        'nome_fantasia', e.nome_fantasia,
        'cnpj', e.cnpj,
        'ie', e.ie,
        'telefone', e.telefone,
        'logradouro', e.logradouro,
        'numero_endereco', e.numero_endereco,
        'bairro', e.bairro,
        'municipio', e.municipio,
        'uf', e.uf,
        'cep', e.cep,
        'logo_url', e.logo_url
      ) FROM empresas e WHERE e.ativa = true ORDER BY e.created_at LIMIT 1
    ),
    'itens', (SELECT json_agg(json_build_object(
      'id', pi.id, 'descricao', pi.descricao, 'especificacao', pi.especificacao,
      'quantidade', pi.quantidade, 'valor_unitario', pi.valor_unitario,
      'valor_total', pi.valor_total,
      'largura_cm', pi.largura_cm, 'altura_cm', pi.altura_cm, 'area_m2', pi.area_m2,
      'grupo_uniao', pi.grupo_uniao, 'nome_exibicao', pi.nome_exibicao, 'item_visivel', pi.item_visivel,
      'imagem_url', pi.imagem_url,
      'aprovado', pi.aprovado
    ) ORDER BY pi.ordem) FROM proposta_itens pi WHERE pi.proposta_id = p.id)
  ) INTO result
  FROM propostas p
  LEFT JOIN clientes c ON c.id = p.cliente_id
  WHERE p.share_token = p_token::uuid
    AND p.share_token_active = true
    AND (p.share_token_expires_at IS NULL OR p.share_token_expires_at > now());
  IF result IS NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada ou link expirado';
  END IF;
  RETURN result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.portal_get_proposta(text) TO anon, authenticated;
