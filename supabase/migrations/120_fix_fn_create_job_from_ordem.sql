-- ============================================================================
-- Migration 120: Fix fn_create_job_from_ordem (bridge ERP -> Campo)
-- ============================================================================
-- Corrige 2 bugs no trigger original descobertos em 2026-04-14:
--
-- 1) OI inserida ja como status='agendada' sem unidade_id/equipe_id caia no
--    fluxo #3 "criar store automaticamente" e gerava store "fake" + job com
--    assigned_to null (lixo no banco -- vide INST-2026-0009).
--
-- 2) Mapeamento errado: jobs.assigned_to tem FK para profiles(id), mas o
--    codigo original atribuia NEW.equipe_id (FK para equipes) direto em
--    assigned_to. Quando equipe_id era null, FK aceitava null e gerava job
--    sem responsavel. Se equipe_id fosse passado, violaria a FK.
--
-- Mudancas:
-- 1. Remove fluxo #3 "criar store automaticamente". Essa responsabilidade
--    passa pra Edge Function dedicada (task: auto-geocoding via Nominatim).
-- 2. Validacao estrita: so cria job se store_id resolvido E data_agendada.
--    Sem store ou sem data -> RAISE WARNING + RETURN NEW (sem lixo).
-- 3. Resolve assigned_to corretamente: busca membro ativo da equipe com
--    funcao='lider' (ILIKE 'lider%'); fallback para primeiro membro ativo.
--    Se nada encontrado ou profile invalido, deixa null (app atribui depois).
-- 4. Dispara em UPDATE tambem quando job ainda nao existe (OI atualizada
--    depois com unidade_id/equipe_id que destravam a criacao).
-- 5. Em UPDATE com job ja existente, sincroniza campos mutaveis
--    (assigned_to, scheduled_date, notes, store_id, pedido_id, pedido_item_id).
-- ============================================================================

BEGIN;

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
  -- So age quando status eh 'agendada'
  IF NEW.status IS DISTINCT FROM 'agendada' THEN
    RETURN NEW;
  END IF;

  -- Resolver store: tentativa 1 via unidade_id
  IF NEW.unidade_id IS NOT NULL THEN
    SELECT s.id INTO v_store_id
    FROM stores s
    WHERE s.cliente_unidade_id = NEW.unidade_id
      AND s.deleted_at IS NULL
    LIMIT 1;
  END IF;

  -- Tentativa 2 via cliente_id + match exato de endereco
  IF v_store_id IS NULL AND NEW.cliente_id IS NOT NULL AND NEW.endereco_completo IS NOT NULL THEN
    SELECT s.id INTO v_store_id
    FROM stores s
    WHERE s.cliente_id = NEW.cliente_id
      AND s.address = SPLIT_PART(NEW.endereco_completo, ' - ', 1)
      AND s.deleted_at IS NULL
    LIMIT 1;
  END IF;

  -- Validacao minima: precisa de store + data_agendada
  IF v_store_id IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem store resolvida (unidade_id=% cliente=%). Job NAO criado.',
      COALESCE(NEW.numero, NEW.id::text), NEW.unidade_id, NEW.cliente_id;
    RETURN NEW;
  END IF;
  IF NEW.data_agendada IS NULL THEN
    RAISE WARNING '[fn_create_job_from_ordem] OI % sem data_agendada. Job NAO criado.',
      COALESCE(NEW.numero, NEW.id::text);
    RETURN NEW;
  END IF;

  -- Resolver assigned_to (profiles.id) a partir de equipe_id (equipes.id)
  -- Preferencia: membro ativo com funcao ILIKE 'lider'; fallback: primeiro ativo
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

    -- Defensivo: confirmar que existe em profiles (evita FK violation)
    IF v_assigned_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_assigned_to) THEN
      v_assigned_to := NULL;
    END IF;
  END IF;

  -- Ja existe job vinculado?
  SELECT id INTO v_existing_job_id
  FROM jobs
  WHERE ordem_instalacao_id = NEW.id
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing_job_id IS NOT NULL THEN
    -- Sincroniza campos mutaveis quando OI muda
    IF TG_OP = 'UPDATE' AND (
         NEW.equipe_id        IS DISTINCT FROM OLD.equipe_id
      OR NEW.data_agendada    IS DISTINCT FROM OLD.data_agendada
      OR COALESCE(NEW.instrucoes, NEW.observacoes) IS DISTINCT FROM COALESCE(OLD.instrucoes, OLD.observacoes)
      OR NEW.pedido_id        IS DISTINCT FROM OLD.pedido_id
      OR NEW.pedido_item_id   IS DISTINCT FROM OLD.pedido_item_id
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

  -- Cria o job
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
  RAISE WARNING '[fn_create_job_from_ordem] Erro na OI %: %',
    COALESCE(NEW.numero, NEW.id::text), SQLERRM;
  RETURN NEW;
END;
$function$;

COMMIT;
