-- ============================================================================
-- 139 — Fix completo do pipeline de disparos do agente de vendas
-- ============================================================================
-- Problema: agent-cron-loop nao conseguia invocar whatsapp-enviar nem
-- agent-enviar-email — recebia HTTP 401 INVALID_JWT_FORMAT do gateway.
-- Causa raiz: Supabase migrou service_role_key para novo formato (sb_secret_xxx),
-- mas o gateway das Edge Functions com verify_jwt=true ainda exige JWT legacy.
-- Como consequencia, 63 mensagens whatsapp ficaram presas em status='aprovada'.
--
-- Solucao implementada (em camadas):
--   FASE 2: JWT legacy seguro no vault + RPCs de dispatch
--   FASE 3: Retry com backoff exponencial + max_tentativas
--   FASE 5: Rampa progressiva de aquecimento (15/30/60 por dia)
--   FASE 7: Tabela agent_campanhas para rastreamento explicito
-- ============================================================================

-- ─── FASE 2: JWT legacy no vault + RPCs ────────────────────────────────────

DO $$
DECLARE
  v_existing_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'service_role_key_legacy_jwt';
  IF v_existing_id IS NULL THEN
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqd2ptZmdwbG5xeWZmZGNnZGF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA2NTY5NywiZXhwIjoyMDg4NjQxNjk3fQ.6whq3LBigRxMdlwIKKii_HsmVpNWgK-9mWNz9B755VY',
      'service_role_key_legacy_jwt',
      'JWT legacy service_role key needed for Edge Functions gateway (verify_jwt=true).'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.get_service_role_key()
RETURNS text
LANGUAGE sql SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT COALESCE(
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key_legacy_jwt' LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_service_role_key_for_dispatch()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  v_role := COALESCE(current_setting('request.jwt.claim.role', true), '');
  IF v_role NOT IN ('service_role') THEN
    RAISE EXCEPTION 'Apenas service_role pode chamar (current=%)', v_role;
  END IF;
  RETURN private.get_service_role_key();
END;
$$;

REVOKE ALL ON FUNCTION public.get_service_role_key_for_dispatch() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_service_role_key_for_dispatch() TO service_role;

-- ─── FASE 3: Retry + backoff em agent_messages ─────────────────────────────

ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS tentativas_envio int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_tentativas_envio int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS proximo_envio timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_agent_messages_dispatch_ready
  ON public.agent_messages (status, proximo_envio, created_at)
  WHERE status = 'aprovada' AND direcao = 'enviada';

-- ─── FASE 5: Rampa progressiva (15 → 30 → 60 / dia) ────────────────────────

CREATE OR REPLACE FUNCTION public.fn_calcular_limite_diario()
RETURNS int
LANGUAGE sql STABLE
AS $$
  WITH primeiro_envio AS (
    SELECT MIN(enviado_em) AS data_inicio
    FROM public.agent_messages
    WHERE canal = 'whatsapp' AND status IN ('enviada','lida','respondida')
      AND enviado_em IS NOT NULL
  ),
  rampa AS (
    SELECT CASE
      WHEN data_inicio IS NULL THEN 1
      ELSE GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (now() - data_inicio)) / 86400)::int + 1)
    END AS dia
    FROM primeiro_envio
  )
  SELECT CASE
    WHEN dia <= 2 THEN 15
    WHEN dia <= 5 THEN 30
    ELSE 60
  END AS limite
  FROM rampa;
$$;

GRANT EXECUTE ON FUNCTION public.fn_calcular_limite_diario() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_calcular_limite_diario() IS
  'Rampa de aquecimento WhatsApp. Dia 1-2: 15/dia, Dia 3-5: 30/dia, Dia 6+: 60/dia.';

-- ─── FASE 7: Tabela agent_campanhas ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  segmento text,
  sub_segmento text,
  template_name text,
  template_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
  total_leads int NOT NULL DEFAULT 0,
  total_mensagens_criadas int NOT NULL DEFAULT 0,
  total_enviadas int NOT NULL DEFAULT 0,
  total_lidas int NOT NULL DEFAULT 0,
  total_respondidas int NOT NULL DEFAULT 0,
  total_erros int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','pausada','concluida','cancelada')),
  criada_em timestamptz NOT NULL DEFAULT now(),
  iniciada_em timestamptz NULL,
  finalizada_em timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  criada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_campanhas_status ON public.agent_campanhas(status);
CREATE INDEX IF NOT EXISTS idx_agent_campanhas_template ON public.agent_campanhas(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_campanhas_segmento ON public.agent_campanhas(segmento);
CREATE INDEX IF NOT EXISTS idx_agent_campanhas_criada_em ON public.agent_campanhas(criada_em DESC);

ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS campanha_id uuid REFERENCES public.agent_campanhas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_messages_campanha
  ON public.agent_messages(campanha_id) WHERE campanha_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.fn_atualizar_contadores_campanha()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.campanha_id IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    UPDATE public.agent_campanhas
    SET total_mensagens_criadas = total_mensagens_criadas + 1
    WHERE id = NEW.campanha_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.agent_campanhas c
    SET
      total_enviadas = (SELECT count(*) FROM public.agent_messages m WHERE m.campanha_id = c.id AND m.status IN ('enviada','lida','respondida')),
      total_lidas = (SELECT count(*) FROM public.agent_messages m WHERE m.campanha_id = c.id AND m.status IN ('lida','respondida')),
      total_respondidas = (SELECT count(*) FROM public.agent_messages m WHERE m.campanha_id = c.id AND m.status = 'respondida'),
      total_erros = (SELECT count(*) FROM public.agent_messages m WHERE m.campanha_id = c.id AND m.status IN ('erro','falha_envio'))
    WHERE c.id = NEW.campanha_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atualizar_contadores_campanha ON public.agent_messages;
CREATE TRIGGER trg_atualizar_contadores_campanha
  AFTER INSERT OR UPDATE OF status ON public.agent_messages
  FOR EACH ROW EXECUTE FUNCTION public.fn_atualizar_contadores_campanha();

ALTER TABLE public.agent_campanhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_campanhas_read ON public.agent_campanhas;
CREATE POLICY p_campanhas_read ON public.agent_campanhas
  FOR SELECT USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('comercial','gerente','admin'))
  );

DROP POLICY IF EXISTS p_campanhas_write ON public.agent_campanhas;
CREATE POLICY p_campanhas_write ON public.agent_campanhas
  FOR ALL USING (
    auth.role() = 'service_role' OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('gerente','admin'))
  );

-- ─── pg_cron: dispatch-approved-messages a cada 30min nas janelas BRT ──────

DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-approved-messages-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-approved-messages-30min',
  '*/30 12-14,17-19 * * 1-6',
  $cmd$
  SELECT net.http_post(
    url := 'https://djwjmfgplnqyffdcgdaw.supabase.co/functions/v1/dispatch-approved-messages',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || private.get_service_role_key()
    ),
    body := '{}'::jsonb
  );
  $cmd$
);
