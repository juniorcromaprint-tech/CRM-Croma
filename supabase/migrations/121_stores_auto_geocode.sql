-- ============================================================================
-- Migration 121: Auto-geocoding de stores novas via Nominatim (OpenStreetMap)
-- ============================================================================
-- Quando uma store eh inserida sem lat/lng e tem address preenchido,
-- dispara async a Edge Function `stores-geocode` que chama Nominatim
-- e preenche as coordenadas.
--
-- Usa pg_net.http_post (fire-and-forget, NAO bloqueia o INSERT).
-- Idempotente: se a store ja tem lat/lng, a Edge retorna skipped.
-- Se Nominatim falhar, a request fica registrada em net._http_response
-- para inspecao posterior.
--
-- Substitui o fluxo #3 removido da fn_create_job_from_ordem na migration 120
-- (que criava stores "fake" quando a OI nao tinha unidade resolvida).
-- ============================================================================

BEGIN;

-- Garante extensao pg_net (ja instalada, mas CREATE EXTENSION IF NOT EXISTS
-- eh idempotente)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.fn_store_auto_geocode()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_url      text := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/stores-geocode';
  -- apikey publishable (seguro em codigo, eh o mesmo que o frontend usa)
  v_apikey   text := 'sb_publishable_AOdTP0fsNoTO5sh4_2ZvuA_bJHEcCu2';
  v_request_id bigint;
BEGIN
  -- So dispara para stores ativas, sem coordenadas, com endereco
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.address IS NULL OR length(trim(NEW.address)) = 0 THEN RETURN NEW; END IF;

  -- Dispara HTTP POST async (fire-and-forget)
  SELECT net.http_post(
    url     := v_url,
    body    := jsonb_build_object('store_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_apikey
    ),
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  -- Registra em auditoria (melhor esforco)
  BEGIN
    INSERT INTO registros_auditoria (tabela, registro_id, acao, dados_novos)
    VALUES ('stores', NEW.id, 'AUTO_GEOCODE_DISPATCHED',
      jsonb_build_object('net_request_id', v_request_id, 'address', NEW.address));
  EXCEPTION WHEN OTHERS THEN
    -- nao aborta se auditoria falhar
    NULL;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_store_auto_geocode] falhou para store %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_auto_geocode ON public.stores;
CREATE TRIGGER trg_store_auto_geocode
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_store_auto_geocode();

-- Helper: permite retrigger manual via UPDATE quando address mudou e ainda sem lat/lng
CREATE OR REPLACE FUNCTION public.fn_store_geocode_on_address_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE v_request_id bigint;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.address IS NULL OR length(trim(NEW.address)) = 0 THEN RETURN NEW; END IF;
  IF NEW.address IS NOT DISTINCT FROM OLD.address
     AND NEW.zip_code IS NOT DISTINCT FROM OLD.zip_code THEN
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url     := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/stores-geocode',
    body    := jsonb_build_object('store_id', NEW.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_AOdTP0fsNoTO5sh4_2ZvuA_bJHEcCu2'
    ),
    timeout_milliseconds := 15000
  ) INTO v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_store_geocode_on_address_change] falhou para store %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_geocode_on_update ON public.stores;
CREATE TRIGGER trg_store_geocode_on_update
  AFTER UPDATE OF address, zip_code ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_store_geocode_on_address_change();

COMMIT;
