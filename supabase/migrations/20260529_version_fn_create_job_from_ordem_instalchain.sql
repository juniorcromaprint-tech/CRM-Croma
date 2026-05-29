-- ============================================================================
-- Versioning migration: fn_create_job_from_ordem + trg_create_job_from_ordem
-- Ciclo autonomo #31 (rotacao Instalacao) — 2026-05-29
-- Veredicto: DRIFT-LIVE≠MIGRATION
--   Migration 120_fix_fn_create_job_from_ordem.sql tem CREATE FUNCTION mas:
--   1) Sem SECURITY DEFINER (live nao tem tambem — OK, ambos sem)
--      MAS sem SET search_path (live tambem nao tem — OK)
--   2) Logica diferente: live adiciona fallback #1 via NEW.store_id direto
--      (coluna store_id na OI); migration 120 nao tem esse fallback.
--   3) Condicao UPDATE sync: live inclui "OR NEW.store_id IS DISTINCT FROM
--      OLD.store_id" que migration 120 nao tem.
--   4) RAISE WARNING no live tem formato diferente do migration 120.
-- ACAO: capturar definicao verbatim do live para source-control.
-- NAO aplicar (no-op de versionagem). NAO mudar logica.
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

  -- 3) Fallback heurístico: cliente_id + endereco_completo (legado)
  IF v_store_id IS NULL AND NEW.cliente_id IS NOT NULL AND NEW.endereco_completo IS NOT NULL THEN
    SELECT s.id INTO v_store_id FROM stores s
    WHERE s.cliente_id = NEW.cliente_id
      AND s.address = SPLIT_PART(NEW.endereco_completo, ' - ', 1)
      AND s.deleted_at IS NULL LIMIT 1;
  END IF;

  IF v_store_id IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem store resolvida. Job NAO criado.', COALESCE(NEW.numero, NEW.id::text);
    RETURN NEW;
  END IF;

  IF NEW.data_agendada IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem data_agendada. Job NAO criado.', COALESCE(NEW.numero, NEW.id::text);
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

  -- Já existe job?
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
    v_store_id, v_os_number, 'Instalação', 'Pendente', NEW.data_agendada,
    COALESCE(NEW.instrucoes, NEW.observacoes),
    v_assigned_to, NEW.id, NEW.pedido_id, NEW.pedido_item_id
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_create_job_from_ordem] Erro na OI %: %', COALESCE(NEW.numero, NEW.id::text), SQLERRM;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_create_job_from_ordem ON public.ordens_instalacao;
CREATE TRIGGER trg_create_job_from_ordem
  AFTER INSERT OR UPDATE ON public.ordens_instalacao
  FOR EACH ROW
  EXECUTE FUNCTION fn_create_job_from_ordem();

COMMENT ON FUNCTION public.fn_create_job_from_ordem() IS
  'Versionado verbatim do live — ciclo autonomo #31 — 2026-05-29. '
  'NAO e mudanca de logica. Drift vs migration 120: live tem fallback #1 '
  'via NEW.store_id direto + condicao OR NEW.store_id IS DISTINCT FROM OLD.store_id '
  'no bloco UPDATE sync. Migration 120 nao tinha esses dois pontos.';
