-- supabase/migrations/099_transicoes_automaticas.sql
-- Triggers de transição automática entre módulos
-- Implementa o fluxo: Pedido aprovado → OP → Instalação → Financeiro → NF-e
-- Idempotente: todos os blocos usam IF NOT EXISTS / exception handling

-- ============================================================
-- PARTE 0: Estender pedidos.status com novos estados do fluxo
-- ============================================================
DO $$
BEGIN
  ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;

  ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
    CHECK (status IN (
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'em_producao',
      'produzido',
      'pronto_entrega',           -- produção pronta, sem necessidade de instalação
      'aguardando_instalacao',
      'em_instalacao',
      'parcialmente_concluido',
      'concluido',
      'faturar',                  -- instalação concluída, aguardando emissão de NF-e
      'faturado',
      'entregue',
      'cancelado'
    ));

  RAISE NOTICE '[099] pedidos.status CHECK estendido com pronto_entrega e faturar';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[099] pedidos.status CHECK — skipped: %', SQLERRM;
END $$;


-- ============================================================
-- TRIGGER 1: Pedido aprovado → Criar Ordens de Produção
-- ============================================================
-- Dispara quando pedidos.status muda para 'aprovado'
-- Cria uma OP por item do pedido (idempotente)
-- Atualiza pedido para 'em_producao'
-- Registra auditoria

CREATE OR REPLACE FUNCTION fn_pedido_aprovado_cria_op()
RETURNS TRIGGER AS $$
DECLARE
  v_item        RECORD;
  v_item_count  INT;
  v_op_count    INT;
  v_ops_criadas INT := 0;
BEGIN
  -- Só dispara quando status muda PARA 'aprovado'
  IF NEW.status != 'aprovado' OR OLD.status = 'aprovado' THEN
    RETURN NEW;
  END IF;

  -- Validação: pedido deve ter itens ativos
  SELECT COUNT(*) INTO v_item_count
  FROM pedido_itens
  WHERE pedido_id = NEW.id AND status != 'cancelado';

  IF v_item_count = 0 THEN
    RAISE NOTICE '[099-T1] Pedido % aprovado sem itens — OP não criada', NEW.numero;
    RETURN NEW;
  END IF;

  -- Criar uma OP por item (idempotente: pula se OP já existe para o item)
  FOR v_item IN
    SELECT pi.id AS pedido_item_id, pi.descricao, pi.quantidade
    FROM pedido_itens pi
    WHERE pi.pedido_id = NEW.id AND pi.status != 'cancelado'
  LOOP
    SELECT COUNT(*) INTO v_op_count
    FROM ordens_producao
    WHERE pedido_item_id = v_item.pedido_item_id;

    IF v_op_count = 0 THEN
      INSERT INTO ordens_producao (
        pedido_id,
        pedido_item_id,
        status,
        prioridade,
        observacoes
      ) VALUES (
        NEW.id,
        v_item.pedido_item_id,
        'aguardando_programacao',
        CASE NEW.prioridade
          WHEN 'urgente' THEN 3
          WHEN 'alta'    THEN 2
          WHEN 'normal'  THEN 1
          ELSE 0
        END,
        'OP gerada automaticamente — Pedido ' || COALESCE(NEW.numero, NEW.id::TEXT)
      );
      v_ops_criadas := v_ops_criadas + 1;
    END IF;
  END LOOP;

  -- Avançar pedido para em_producao (UPDATE separado pois trigger é AFTER)
  UPDATE pedidos
  SET status = 'em_producao', updated_at = NOW()
  WHERE id = NEW.id AND status = 'aprovado';

  -- Auditoria
  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES (
    'pedidos',
    NEW.id,
    'STATUS_CHANGE',
    jsonb_build_object(
      'evento',      'pedido_aprovado_criou_op',
      'pedido',      NEW.numero,
      'itens',       v_item_count,
      'ops_criadas', v_ops_criadas
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T1] fn_pedido_aprovado_cria_op — Erro: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pedido_aprovado_cria_op ON pedidos;
CREATE TRIGGER trg_pedido_aprovado_cria_op
  AFTER UPDATE OF status ON pedidos
  FOR EACH ROW
  EXECUTE FUNCTION fn_pedido_aprovado_cria_op();


-- ============================================================
-- TRIGGER 2: OP finalizada → Criar Instalação ou Marcar Pronto
-- ============================================================
-- Dispara quando ordens_producao.status muda para 'finalizado'
-- Se ainda houver OPs pendentes do mesmo pedido, aguarda
-- Se pedido requer instalação → cria ordens_instalacao
-- Se não requer instalação → atualiza pedido para 'pronto_entrega'

CREATE OR REPLACE FUNCTION fn_op_finalizada_transicao()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido          RECORD;
  v_requer_inst     BOOLEAN;
  v_ops_pendentes   INT;
  v_inst_count      INT;
BEGIN
  -- Só dispara quando status muda PARA 'finalizado'
  IF NEW.status != 'finalizado' OR OLD.status = 'finalizado' THEN
    RETURN NEW;
  END IF;

  -- Obter pedido vinculado
  SELECT * INTO v_pedido
  FROM pedidos
  WHERE id = NEW.pedido_id;

  IF v_pedido IS NULL THEN
    RAISE NOTICE '[099-T2] OP % sem pedido vinculado — ignorado', COALESCE(NEW.numero, NEW.id::TEXT);
    RETURN NEW;
  END IF;

  -- Se o pedido já passou desse estado, não retroceder
  IF v_pedido.status IN ('pronto_entrega', 'aguardando_instalacao', 'em_instalacao',
                         'concluido', 'faturar', 'faturado', 'entregue', 'cancelado') THEN
    RETURN NEW;
  END IF;

  -- Verificar se ainda há OPs pendentes para o mesmo pedido
  SELECT COUNT(*) INTO v_ops_pendentes
  FROM ordens_producao
  WHERE pedido_id = NEW.pedido_id
    AND id != NEW.id
    AND status NOT IN ('finalizado');

  IF v_ops_pendentes > 0 THEN
    RAISE NOTICE '[099-T2] OP % finalizada — pedido % aguarda % OPs restantes',
      COALESCE(NEW.numero, '?'), v_pedido.numero, v_ops_pendentes;
    RETURN NEW;
  END IF;

  -- Verificar se algum item do pedido requer instalação
  SELECT COALESCE(bool_or(pr.requer_instalacao), FALSE) INTO v_requer_inst
  FROM pedido_itens pi
  LEFT JOIN produtos pr ON pr.id = pi.produto_id
  WHERE pi.pedido_id = NEW.pedido_id
    AND pi.status != 'cancelado';

  IF v_requer_inst THEN
    -- Criar ordem de instalação se não existir (idempotente)
    SELECT COUNT(*) INTO v_inst_count
    FROM ordens_instalacao
    WHERE pedido_id = NEW.pedido_id
      AND status NOT IN ('nao_concluida');

    IF v_inst_count = 0 THEN
      INSERT INTO ordens_instalacao (
        pedido_id,
        cliente_id,
        status,
        observacoes
      ) VALUES (
        v_pedido.id,
        v_pedido.cliente_id,
        'aguardando_agendamento',
        'Instalação gerada automaticamente após produção — Pedido ' || v_pedido.numero
      );
    END IF;

    -- Avançar pedido para aguardando_instalacao
    UPDATE pedidos
    SET status = 'aguardando_instalacao', updated_at = NOW()
    WHERE id = NEW.pedido_id
      AND status IN ('em_producao', 'produzido', 'aprovado');

  ELSE
    -- Sem instalação: marcar como pronto para entrega
    UPDATE pedidos
    SET status = 'pronto_entrega', updated_at = NOW()
    WHERE id = NEW.pedido_id
      AND status IN ('em_producao', 'produzido', 'aprovado');
  END IF;

  -- Auditoria
  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES (
    'ordens_producao',
    NEW.id,
    'STATUS_CHANGE',
    jsonb_build_object(
      'evento',             'op_finalizada_transicao',
      'op',                 COALESCE(NEW.numero, NEW.id::TEXT),
      'pedido',             v_pedido.numero,
      'requer_instalacao',  v_requer_inst,
      'inst_criada',        (v_requer_inst AND v_inst_count = 0)
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T2] fn_op_finalizada_transicao — Erro: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_op_finalizada_transicao ON ordens_producao;
CREATE TRIGGER trg_op_finalizada_transicao
  AFTER UPDATE OF status ON ordens_producao
  FOR EACH ROW
  EXECUTE FUNCTION fn_op_finalizada_transicao();


-- ============================================================
-- TRIGGER 3: Instalação concluída → Gerar título financeiro
-- ============================================================
-- Dispara quando ordens_instalacao.status muda para 'concluida'
-- Cria contas_receber (se não existir para o pedido)
-- Atualiza pedido para 'faturar'

CREATE OR REPLACE FUNCTION fn_instalacao_concluida_financeiro()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido    RECORD;
  v_cr_count  INT;
  v_cr_criado BOOLEAN := FALSE;
BEGIN
  -- Só dispara quando status muda PARA 'concluida'
  IF NEW.status != 'concluida' OR OLD.status = 'concluida' THEN
    RETURN NEW;
  END IF;

  -- Obter pedido vinculado
  SELECT * INTO v_pedido
  FROM pedidos
  WHERE id = NEW.pedido_id;

  IF v_pedido IS NULL THEN
    RAISE NOTICE '[099-T3] Instalação % sem pedido vinculado', COALESCE(NEW.numero, NEW.id::TEXT);
    RETURN NEW;
  END IF;

  -- Criar conta a receber se não existir (idempotente)
  SELECT COUNT(*) INTO v_cr_count
  FROM contas_receber
  WHERE pedido_id = NEW.pedido_id
    AND status NOT IN ('cancelado');

  IF v_cr_count = 0 THEN
    INSERT INTO contas_receber (
      pedido_id,
      cliente_id,
      numero_titulo,
      valor_original,
      saldo,
      data_emissao,
      data_vencimento,
      status,
      observacoes
    ) VALUES (
      v_pedido.id,
      v_pedido.cliente_id,
      'INST-' || COALESCE(NEW.numero, substring(NEW.id::TEXT, 1, 8)),
      v_pedido.valor_total,
      v_pedido.valor_total,
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days',
      'a_vencer',
      'Título gerado automaticamente após instalação concluída — ' || v_pedido.numero
    );
    v_cr_criado := TRUE;
  END IF;

  -- Avançar pedido para aguardando faturamento
  UPDATE pedidos
  SET status = 'faturar', updated_at = NOW()
  WHERE id = NEW.pedido_id
    AND status NOT IN ('faturado', 'entregue', 'cancelado');

  -- Auditoria
  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES (
    'ordens_instalacao',
    NEW.id,
    'STATUS_CHANGE',
    jsonb_build_object(
      'evento',     'instalacao_concluida_financeiro',
      'instalacao', COALESCE(NEW.numero, NEW.id::TEXT),
      'pedido',     v_pedido.numero,
      'valor',      v_pedido.valor_total,
      'cr_criado',  v_cr_criado
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T3] fn_instalacao_concluida_financeiro — Erro: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_instalacao_concluida_financeiro ON ordens_instalacao;
CREATE TRIGGER trg_instalacao_concluida_financeiro
  AFTER UPDATE OF status ON ordens_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION fn_instalacao_concluida_financeiro();


-- ============================================================
-- TRIGGER 4: NF-e autorizada → Atualizar pedido para 'faturado'
-- ============================================================
-- Dispara quando fiscal_documentos.status muda para 'autorizado'
-- Complementa o trigger existente trg_fiscal_sincronizar_status_pedido
-- que atualiza status_fiscal — este atualiza o status principal do pedido

CREATE OR REPLACE FUNCTION fn_nfe_autorizada_pedido_status()
RETURNS TRIGGER AS $$
DECLARE
  v_pedido RECORD;
BEGIN
  -- Só dispara quando status muda PARA 'autorizado'
  IF NEW.status != 'autorizado' OR OLD.status = 'autorizado' THEN
    RETURN NEW;
  END IF;

  -- Apenas NF-e (não NFS-e)
  IF NEW.tipo_documento != 'nfe' THEN
    RETURN NEW;
  END IF;

  -- Requer pedido vinculado
  IF NEW.pedido_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obter pedido
  SELECT * INTO v_pedido FROM pedidos WHERE id = NEW.pedido_id;

  IF v_pedido IS NULL OR v_pedido.status IN ('faturado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  -- Marcar pedido como faturado
  UPDATE pedidos
  SET status = 'faturado', updated_at = NOW()
  WHERE id = NEW.pedido_id;

  -- Auditoria
  INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
  VALUES (
    'fiscal_documentos',
    NEW.id,
    'STATUS_CHANGE',
    jsonb_build_object(
      'evento',       'nfe_autorizada_pedido_faturado',
      'documento_id', NEW.id,
      'pedido',       v_pedido.numero,
      'chave_nfe',    NEW.chave_acesso
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[099-T4] fn_nfe_autorizada_pedido_status — Erro: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_nfe_autorizada_pedido_status ON fiscal_documentos;
CREATE TRIGGER trg_nfe_autorizada_pedido_status
  AFTER UPDATE OF status ON fiscal_documentos
  FOR EACH ROW
  EXECUTE FUNCTION fn_nfe_autorizada_pedido_status();


-- ============================================================
-- Comentários
-- ============================================================
COMMENT ON FUNCTION fn_pedido_aprovado_cria_op() IS
  'T1: Pedido aprovado → cria OPs por item, avança pedido para em_producao';

COMMENT ON FUNCTION fn_op_finalizada_transicao() IS
  'T2: OP finalizada → se todas OPs prontas: cria instalação (se requer) ou pronto_entrega';

COMMENT ON FUNCTION fn_instalacao_concluida_financeiro() IS
  'T3: Instalação concluída → cria contas_receber + avança pedido para faturar';

COMMENT ON FUNCTION fn_nfe_autorizada_pedido_status() IS
  'T4: NF-e autorizada → atualiza pedido.status para faturado (complementa status_fiscal)';

RAISE NOTICE '[099] Triggers de transição automática instalados com sucesso';
