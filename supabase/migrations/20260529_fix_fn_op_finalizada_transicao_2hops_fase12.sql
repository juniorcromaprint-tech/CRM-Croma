-- Fase 1.2: corrige a chain Producao->Instalacao
-- Aplicada via MCP apply_migration em 2026-05-29 (sessao monitor, autorizada Junior).
-- ANTES: fn_op_finalizada_transicao tentava status 'pronto_entrega' (inexistente no CHECK pedidos_status_check)
--        e salto direto em_producao->aguardando_instalacao (rejeitado por fn_validar_transicao_status).
--        EXCEPTION WHEN OTHERS engolia o erro -> pedido travava em 'em_producao'. Evidencia: production_completed_transition=0 lifetime.
-- AGORA: 2 hops validos (em_producao->produzido->aguardando_instalacao|concluido) respeitando o validador,
--        + erro deixa de ser silencioso: grava system_events 'production_transition_error'.
-- Efeito financeiro: NENHUM (comissao so dispara em 'faturado'; conta_receber so em 'aprovado' - verificado no codigo dos triggers).
CREATE OR REPLACE FUNCTION public.fn_op_finalizada_transicao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  v_pedido RECORD; v_requer_inst BOOLEAN; v_ops_pendentes INT; v_inst_count INT;
  v_destino TEXT;
BEGIN
  IF NEW.status NOT IN ('finalizado','concluida') THEN RETURN NEW; END IF;
  IF OLD.status IN ('finalizado','concluida') THEN RETURN NEW; END IF;

  SELECT * INTO v_pedido FROM pedidos WHERE id = NEW.pedido_id;
  IF v_pedido IS NULL THEN RETURN NEW; END IF;
  IF v_pedido.status IN ('aguardando_instalacao','em_instalacao',
       'parcialmente_concluido','concluido','faturado','entregue','cancelado') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_ops_pendentes FROM ordens_producao
   WHERE pedido_id = NEW.pedido_id AND id != NEW.id
     AND status NOT IN ('finalizado','concluida','cancelada');
  IF v_ops_pendentes > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(bool_or(pr.requer_instalacao), FALSE) INTO v_requer_inst
   FROM pedido_itens pi LEFT JOIN produtos pr ON pr.id = pi.produto_id
   WHERE pi.pedido_id = NEW.pedido_id AND pi.status != 'cancelado';

  -- HOP 1: em_producao -> produzido (validador permite)
  UPDATE pedidos SET status='produzido', updated_at=NOW()
   WHERE id=NEW.pedido_id AND status IN ('em_producao','aprovado');

  IF v_requer_inst THEN
    SELECT COUNT(*) INTO v_inst_count FROM ordens_instalacao
     WHERE pedido_id = NEW.pedido_id AND status NOT IN ('cancelada');
    IF v_inst_count = 0 THEN
      INSERT INTO ordens_instalacao (pedido_id, cliente_id, status, observacoes)
      VALUES (v_pedido.id, v_pedido.cliente_id, 'aguardando_agendamento',
              'Instalacao automatica — Pedido ' || v_pedido.numero);
    END IF;
    v_destino := 'aguardando_instalacao';
  ELSE
    v_destino := 'concluido';
  END IF;

  -- HOP 2: produzido -> aguardando_instalacao | concluido (ambos validos)
  UPDATE pedidos SET status=v_destino, updated_at=NOW()
   WHERE id=NEW.pedido_id AND status='produzido';

  INSERT INTO system_events (event_type, entity_type, entity_id, payload)
  VALUES ('production_completed_transition','ordem_producao', NEW.id,
    jsonb_build_object('pedido_id',v_pedido.id,'pedido_numero',v_pedido.numero,
      'requer_instalacao',v_requer_inst,'novo_status',v_destino));

  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES ('ordens_producao', NEW.id, 'STATUS_CHANGE',
    jsonb_build_object('evento','op_finalizada_transicao','pedido',v_pedido.numero,
      'requer_instalacao',v_requer_inst,'destino',v_destino));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T2] fn_op_finalizada_transicao FALHOU pedido=% op=%: %',
    NEW.pedido_id, NEW.id, SQLERRM;
  BEGIN
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('production_transition_error','ordem_producao', NEW.id,
      jsonb_build_object('pedido_id',NEW.pedido_id,'sqlerrm',SQLERRM,'sqlstate',SQLSTATE));
  EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN NEW;
END;
$function$;
