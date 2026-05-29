-- ============================================================================
-- Versioning migration: fn_op_finalizada_transicao + trg_op_finalizada_transicao
-- Ciclo autonomo #31 (rotacao Instalacao) — 2026-05-29
-- Veredicto: DRIFT-LIVE≠MIGRATION
--
-- ⚠️ BLOCKED — funcao QUEBRADA por conflito de state-machine (ciclo #26).
--    Junior decidira o fix. NAO APLICAR ESTA MIGRATION.
--    Objetivo desta migration: APENAS capturar estado atual do live para
--    source-control. Versionar != consertar.
--
-- Diferencas live vs migration 099_transicoes_automaticas.sql:
--   1) 099 sem SECURITY DEFINER; live tem SECURITY DEFINER
--   2) 099 sem SET search_path; live tem SET search_path TO 'public','pg_temp'
--   3) 099: IF NEW.status != 'finalizado' OR OLD.status = 'finalizado'
--      live: IF NEW.status NOT IN ('finalizado','concluida') THEN ...
--            IF OLD.status IN ('finalizado','concluida') THEN ...
--      (live aceita 'concluida' como status terminal alem de 'finalizado')
--   4) 099: guard idempotencia OI usa status NOT IN ('nao_concluida')
--      live: usa status NOT IN ('cancelada')  — semantica diferente
--   5) 099: nao tem INSERT em system_events
--      live: tem INSERT system_events('production_completed_transition')
--   6) 099: ops pendentes filtram NOT IN ('finalizado')
--      live: filtram NOT IN ('finalizado','concluida','cancelada')
--   7) 099: RAISE WARNING com tag [099-T2] diferente do live [099-T2]
--      (tags iguais mas corpo de log diferente)
--   8) live: nao tem RAISE NOTICE intermediario (099 tinha)
-- ============================================================================

-- ⚠️ BLOCKED — NAO APLICAR. Veja comentario acima.
CREATE OR REPLACE FUNCTION public.fn_op_finalizada_transicao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pedido RECORD; v_requer_inst BOOLEAN; v_ops_pendentes INT; v_inst_count INT;
BEGIN
  IF NEW.status NOT IN ('finalizado','concluida') THEN RETURN NEW; END IF;
  IF OLD.status IN ('finalizado','concluida') THEN RETURN NEW; END IF;

  SELECT * INTO v_pedido FROM pedidos WHERE id = NEW.pedido_id;
  IF v_pedido IS NULL THEN RETURN NEW; END IF;
  IF v_pedido.status IN ('pronto_entrega','aguardando_instalacao','em_instalacao','concluido','faturar','faturado','entregue','cancelado') THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_ops_pendentes FROM ordens_producao
  WHERE pedido_id = NEW.pedido_id AND id != NEW.id AND status NOT IN ('finalizado','concluida','cancelada');
  IF v_ops_pendentes > 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(bool_or(pr.requer_instalacao), FALSE) INTO v_requer_inst
  FROM pedido_itens pi LEFT JOIN produtos pr ON pr.id = pi.produto_id
  WHERE pi.pedido_id = NEW.pedido_id AND pi.status != 'cancelado';

  IF v_requer_inst THEN
    SELECT COUNT(*) INTO v_inst_count FROM ordens_instalacao
    WHERE pedido_id = NEW.pedido_id AND status NOT IN ('cancelada');
    IF v_inst_count = 0 THEN
      INSERT INTO ordens_instalacao (pedido_id, cliente_id, status, observacoes)
      VALUES (v_pedido.id, v_pedido.cliente_id, 'aguardando_agendamento',
              'Instalação automática — Pedido ' || v_pedido.numero);
    END IF;
    UPDATE pedidos SET status='aguardando_instalacao', updated_at=NOW()
    WHERE id=NEW.pedido_id AND status IN ('em_producao','produzido','aprovado');
  ELSE
    UPDATE pedidos SET status='pronto_entrega', updated_at=NOW()
    WHERE id=NEW.pedido_id AND status IN ('em_producao','produzido','aprovado');
  END IF;

  INSERT INTO system_events (event_type, entity_type, entity_id, payload)
  VALUES ('production_completed_transition', 'ordem_producao', NEW.id,
    jsonb_build_object('pedido_id',v_pedido.id,'pedido_numero',v_pedido.numero,
      'requer_instalacao',v_requer_inst,
      'novo_status',CASE WHEN v_requer_inst THEN 'aguardando_instalacao' ELSE 'pronto_entrega' END));

  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES ('ordens_producao', NEW.id, 'STATUS_CHANGE',
    jsonb_build_object('evento','op_finalizada_transicao','pedido',v_pedido.numero,'requer_instalacao',v_requer_inst));

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T2] Erro: %', SQLERRM; RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_op_finalizada_transicao ON public.ordens_producao;
CREATE TRIGGER trg_op_finalizada_transicao
  AFTER UPDATE OF status ON public.ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_op_finalizada_transicao();

COMMENT ON FUNCTION public.fn_op_finalizada_transicao() IS
  'Versionado verbatim do live — ciclo autonomo #31 — 2026-05-29. '
  'NAO e mudanca de logica. BLOCKED: funcao quebrada por conflito state-machine '
  '(ciclo #26) — Junior decide o fix. Esta migration CAPTURA o estado quebrado '
  'atual para source-control. Diferencas vs 099: SECURITY DEFINER adicionado, '
  'SET search_path adicionado, aceita concluida como terminal, guard OI usa '
  'cancelada em vez de nao_concluida, INSERT system_events adicionado.';
