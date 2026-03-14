-- 022_fix_portal_aprovacao.sql
-- Corrige o fluxo de aprovação do portal público:
-- Quando o cliente aprova, status vai direto para 'aprovada' (não 'aprovada_cliente')
-- eliminando o clique extra do vendedor para converter.

-- Remove o status 'aprovada_cliente' do CHECK constraint (não é mais necessário no fluxo normal)
-- Mantemos o valor no enum por compatibilidade com dados históricos — apenas paramos de usá-lo.

CREATE OR REPLACE FUNCTION public.portal_aprovar_proposta(
  p_token UUID, p_comentario TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE v_proposta_id UUID;
BEGIN
  SELECT id INTO v_proposta_id FROM propostas
  WHERE share_token = p_token AND share_token_active = true
    AND aprovado_pelo_cliente = false
    AND (share_token_expires_at IS NULL OR share_token_expires_at > now());
  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta não encontrada, já aprovada, ou link expirado';
  END IF;
  UPDATE propostas SET
    aprovado_pelo_cliente = true,
    aprovado_pelo_cliente_at = now(),
    comentario_cliente = p_comentario,
    ip_aprovacao = inet_client_addr(),
    status = 'aprovada',
    updated_at = now()
  WHERE id = v_proposta_id;
  INSERT INTO notifications (user_id, tipo, titulo, mensagem, entidade_tipo, entidade_id)
  SELECT p.vendedor_id, 'aprovacao_cliente',
    'Cliente aprovou orçamento ' || p.numero,
    COALESCE(p_comentario, 'Aprovado sem comentários'),
    'proposta', v_proposta_id
  FROM propostas p WHERE p.id = v_proposta_id AND p.vendedor_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
