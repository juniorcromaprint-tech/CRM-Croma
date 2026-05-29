-- ============================================================================
-- INSTAL-03 EMIT MIGRATION - VALIDADA, NAO APLICADA (ciclo autonomo #28)
-- ============================================================================
-- STATUS: pronta para aplicar em JANELA MONITORADA (Junior presente OU diurno).
-- NAO aplicada no ciclo #28 (run de madrugada nao-monitorado) por seguranca:
--   reproduzir ~80 LOC de trigger function viva da chain de instalacao em run
--   autonomo nao-monitorado = anti-pattern #11/#14/#21.
--
-- OBJETIVO: tornar rastreavel o skip silencioso de fn_create_job_from_ordem
--   (hoje so RAISE WARNING + RETURN NEW, invisivel no banco) emitindo
--   system_event 'job_skip_sem_store' / 'job_skip_sem_data'.
--
-- VALIDACAO FEITA (ciclo #28):
--   - Corpo recuperado via pg_get_functiondef (nao inventado).
--   - system_events colunas confirmadas: event_type/entity_type/entity_id (NOT NULL) + payload (jsonb).
--   - Pattern de INSERT copiado de fn_installation_completed (canonico do projeto).
--   - Risco avaliado BAIXO: INSERT antes do RETURN NEW; EXCEPTION WHEN OTHERS ja
--     existente captura falha do INSERT sem abortar a OI; CREATE OR REPLACE nao recria o trigger.
--
-- *** ANTES DE APLICAR (obrigatorio) ***
--   1) Re-fetch o corpo atual: SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='fn_create_job_from_ordem';
--   2) CONFIRMAR se a funcao tem SECURITY DEFINER e/ou SET search_path - se tiver,
--      ADICIONAR essas clausulas neste CREATE OR REPLACE (o pg_get_functiondef do recon NAO mostrou
--      SECURITY DEFINER nem search_path; se o original tiver, este script abaixo precisa incorporar).
--   3) Garantir que o corpo abaixo == corpo atual (so com os 2 INSERTs adicionados).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_create_job_from_ordem()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_store_id        UUID;
  v_os_number       TEXT;
  v_existing_job_id UUID;
  v_assigned_to     UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'agendada' THEN RETURN NEW; END IF;

  -- 1) Preferir store_id direto da OI
  IF NEW.store_id IS NOT NULL THEN
    SELECT s.id INTO v_store_id FROM stores s
    WHERE s.id = NEW.store_id AND s.deleted_at IS NULL LIMIT 1;
  END IF;

  -- 2) Fallback: via cliente_unidade
  IF v_store_id IS NULL AND NEW.unidade_id IS NOT NULL THEN
    SELECT s.id INTO v_store_id FROM stores s
    WHERE s.cliente_unidade_id = NEW.unidade_id AND s.deleted_at IS NULL LIMIT 1;
  END IF;

  -- 3) Fallback heuristico: cliente_id + endereco_completo (legado)
  IF v_store_id IS NULL AND NEW.cliente_id IS NOT NULL AND NEW.endereco_completo IS NOT NULL THEN
    SELECT s.id INTO v_store_id FROM stores s
    WHERE s.cliente_id = NEW.cliente_id
      AND s.address = SPLIT_PART(NEW.endereco_completo, ' - ', 1)
      AND s.deleted_at IS NULL LIMIT 1;
  END IF;

  IF v_store_id IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem store resolvida. Job NAO criado.', COALESCE(NEW.numero, NEW.id::text);
    -- OBSERVABILIDADE INSTAL-03: emitir event rastreavel
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES (
      'job_skip_sem_store', 'ordem_instalacao', NEW.id,
      jsonb_build_object(
        'numero', NEW.numero, 'status', NEW.status, 'store_id_raw', NEW.store_id,
        'unidade_id', NEW.unidade_id, 'cliente_id', NEW.cliente_id,
        'data_agendada', NEW.data_agendada, 'tg_op', TG_OP, 'skipped_at', now()
      )
    );
    RETURN NEW;
  END IF;

  IF NEW.data_agendada IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem data_agendada. Job NAO criado.', COALESCE(NEW.numero, NEW.id::text);
    -- OBSERVABILIDADE INSTAL-03: emitir event rastreavel
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES (
      'job_skip_sem_data', 'ordem_instalacao', NEW.id,
      jsonb_build_object(
        'numero', NEW.numero, 'status', NEW.status, 'store_id_resolvido', v_store_id,
        'data_agendada', NEW.data_agendada, 'tg_op', TG_OP, 'skipped_at', now()
      )
    );
    RETURN NEW;
  END IF;

  -- Resolver assigned_to via equipe_membros
  IF NEW.equipe_id IS NOT NULL THEN
    SELECT usuario_id INTO v_assigned_to
    FROM equipe_membros
    WHERE equipe_id = NEW.equipe_id AND ativo = true AND funcao ILIKE 'lider%'
    ORDER BY created_at LIMIT 1;
    IF v_assigned_to IS NULL THEN
      SELECT usuario_id INTO v_assigned_to
      FROM equipe_membros
      WHERE equipe_id = NEW.equipe_id AND ativo = true
      ORDER BY created_at LIMIT 1;
    END IF;
    IF v_assigned_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned_to) THEN
      v_assigned_to := NULL;
    END IF;
  END IF;

  -- Ja existe job?
  SELECT id INTO v_existing_job_id FROM jobs
  WHERE ordem_instalacao_id = NEW.id AND deleted_at IS NULL LIMIT 1;

  IF v_existing_job_id IS NOT NULL THEN
    IF TG_OP = 'UPDATE' AND (
         NEW.equipe_id        IS DISTINCT FROM OLD.equipe_id
      OR NEW.data_agendada    IS DISTINCT FROM OLD.data_agendada
      OR COALESCE(NEW.instrucoes, NEW.observacoes) IS DISTINCT FROM COALESCE(OLD.instrucoes, OLD.observacoes)
      OR NEW.pedido_id        IS DISTINCT FROM OLD.pedido_id
      OR NEW.pedido_item_id   IS DISTINCT FROM OLD.pedido_item_id
      OR NEW.store_id         IS DISTINCT FROM OLD.store_id
    ) THEN
      UPDATE jobs
      SET assigned_to    = v_assigned_to,
          scheduled_date = NEW.data_agendada,
          notes          = COALESCE(NEW.instrucoes, NEW.observacoes),
          pedido_id      = NEW.pedido_id,
          pedido_item_id = NEW.pedido_item_id,
          store_id       = v_store_id
      WHERE id = v_existing_job_id;
    END IF;
    RETURN NEW;
  END IF;

  v_os_number := COALESCE(
    NEW.numero,
    'OS-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD((EXTRACT(EPOCH FROM NOW())::BIGINT % 10000)::TEXT, 4, '0')
  );

  INSERT INTO jobs (
    store_id, os_number, type, status, scheduled_date, notes,
    assigned_to, ordem_instalacao_id, pedido_id, pedido_item_id
  ) VALUES (
    v_store_id, v_os_number, 'Instalacao', 'Pendente', NEW.data_agendada,
    COALESCE(NEW.instrucoes, NEW.observacoes),
    v_assigned_to, NEW.id, NEW.pedido_id, NEW.pedido_item_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_create_job_from_ordem] Erro na OI %: %', COALESCE(NEW.numero, NEW.id::text), SQLERRM;
  RETURN NEW;
END;
$function$;
