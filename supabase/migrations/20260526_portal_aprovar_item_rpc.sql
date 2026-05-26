-- 20260526_portal_aprovar_item_rpc.sql
-- FASE 2-B — RPC para aprovar/recusar item individual no portal /p/:token.
-- Recalcula automaticamente o status agregado da proposta:
--   todos aprovados -> 'aprovada_cliente'
--   algum decidido (mas nem todos aprovados) -> 'aprovacao_parcial'
--   nenhum decidido -> mantem status atual
-- Bloqueia alteracao se proposta ja esta convertida/recusada/expirada.

CREATE OR REPLACE FUNCTION public.portal_aprovar_item(p_token uuid, p_item_id uuid, p_aprovado boolean)
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
  SELECT id, status
    INTO v_proposta_id, v_status_atual
    FROM propostas
   WHERE share_token = p_token;

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Token invalido' USING ERRCODE = 'P0001';
  END IF;

  IF v_status_atual IN ('convertida', 'recusada', 'expirada') THEN
    RAISE EXCEPTION 'Proposta % nao aceita mais alteracoes', v_status_atual USING ERRCODE = 'P0001';
  END IF;

  UPDATE proposta_itens
     SET aprovado = p_aprovado
   WHERE id = p_item_id
     AND proposta_id = v_proposta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item nao pertence a esta proposta' USING ERRCODE = 'P0001';
  END IF;

  -- Apenas itens visiveis contam — espelha PortalItemList no front.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE aprovado IS TRUE),
    COUNT(*) FILTER (WHERE aprovado IS FALSE),
    COUNT(*) FILTER (WHERE aprovado IS NULL)
  INTO v_total_itens, v_aprovados, v_recusados, v_pendentes
  FROM proposta_itens
  WHERE proposta_id = v_proposta_id
    AND (item_visivel IS NULL OR item_visivel = TRUE);

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

GRANT EXECUTE ON FUNCTION public.portal_aprovar_item(uuid, uuid, boolean) TO anon, authenticated;
