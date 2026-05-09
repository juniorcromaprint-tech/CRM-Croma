-- ============================================================================
-- 142 — Rastreamento de eventos de email (Resend webhook)
-- ============================================================================
-- Problema (auditado em 2026-05-08): disparos para leads via /leads marcam
-- agent_messages.status='enviada' assim que Resend aceita o request, mas
-- bounces/delivers/complaints assíncronos NÃO chegam ao CRM. Resultado:
-- 50 emails enviados, 0 retorno visível, sem como saber se foram entregues.
--
-- Solução:
--   1. Tabela email_events: histórico bruto de todo evento do Resend.
--   2. Colunas delivery_status + delivery_status_at em agent_messages.
--   3. Trigger que reflete o último evento na coluna delivery_status.
--
-- A Edge Function `resend-webhook` consome o webhook do Resend, valida
-- assinatura HMAC, persiste em email_events e dispara o trigger.
--
-- Documentação Resend: https://resend.com/docs/dashboard/webhooks/event-types
-- ============================================================================

-- ─── 1. Tabela email_events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id     text NOT NULL,
  event_type    text NOT NULL CHECK (event_type IN (
                  'email.sent',
                  'email.delivered',
                  'email.delivery_delayed',
                  'email.bounced',
                  'email.complained',
                  'email.opened',
                  'email.clicked',
                  'email.failed'
                )),
  occurred_at   timestamptz NOT NULL,
  to_email      text,
  subject       text,
  payload       jsonb NOT NULL,
  agent_message_id uuid REFERENCES public.agent_messages(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_events_resend
  ON public.email_events(resend_id);

CREATE INDEX IF NOT EXISTS idx_email_events_type
  ON public.email_events(event_type);

CREATE INDEX IF NOT EXISTS idx_email_events_message
  ON public.email_events(agent_message_id)
  WHERE agent_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_email_events_occurred
  ON public.email_events(occurred_at DESC);

-- Dedup defensivo: o Resend pode reenviar o mesmo evento (retry).
-- (resend_id, event_type, occurred_at) deveria ser único por entrega.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_email_events_dedup
  ON public.email_events(resend_id, event_type, occurred_at);

COMMENT ON TABLE public.email_events IS
  'Histórico bruto de eventos do Resend. Populado pela Edge Function resend-webhook.';

-- Índice expression para o lookup do trigger (resend_id em metadata)
CREATE INDEX IF NOT EXISTS idx_agent_messages_resend_id
  ON public.agent_messages ((metadata->>'resend_id'))
  WHERE metadata ? 'resend_id';

-- ─── 2. Colunas de status de entrega em agent_messages ─────────────────────

ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS delivery_status text
    CHECK (delivery_status IS NULL OR delivery_status IN (
      'sent', 'delivered', 'delayed', 'bounced',
      'complained', 'opened', 'clicked', 'failed'
    )),
  ADD COLUMN IF NOT EXISTS delivery_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_meta jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_agent_messages_delivery
  ON public.agent_messages(delivery_status)
  WHERE delivery_status IS NOT NULL;

COMMENT ON COLUMN public.agent_messages.delivery_status IS
  'Estado mais recente do email no Resend. Atualizado pelo webhook em ordem de prioridade definida no trigger.';

-- ─── 3. Trigger que reflete o evento mais "forte" no agent_messages ────────
-- Prioridade (mais forte sobrepõe): bounced > failed > complained > clicked >
--                                   opened > delivered > delayed > sent

CREATE OR REPLACE FUNCTION public.fn_apply_email_event_to_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id uuid;
  v_new_status text;
  v_priority   int;
  v_current_priority int;
BEGIN
  -- 1) Resolver agent_message_id pelo resend_id se não veio explícito
  IF NEW.agent_message_id IS NULL AND NEW.resend_id IS NOT NULL THEN
    SELECT id INTO v_message_id
    FROM public.agent_messages
    WHERE metadata->>'resend_id' = NEW.resend_id
    LIMIT 1;
    NEW.agent_message_id := v_message_id;
  ELSE
    v_message_id := NEW.agent_message_id;
  END IF;

  IF v_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2) Mapear evento → status simples + prioridade
  v_new_status := CASE NEW.event_type
    WHEN 'email.sent'             THEN 'sent'
    WHEN 'email.delivered'        THEN 'delivered'
    WHEN 'email.delivery_delayed' THEN 'delayed'
    WHEN 'email.bounced'          THEN 'bounced'
    WHEN 'email.complained'       THEN 'complained'
    WHEN 'email.opened'           THEN 'opened'
    WHEN 'email.clicked'          THEN 'clicked'
    WHEN 'email.failed'           THEN 'failed'
  END;

  v_priority := CASE v_new_status
    WHEN 'sent'        THEN 1
    WHEN 'delayed'     THEN 2
    WHEN 'delivered'   THEN 3
    WHEN 'opened'      THEN 4
    WHEN 'clicked'     THEN 5
    WHEN 'complained'  THEN 6
    WHEN 'failed'      THEN 7
    WHEN 'bounced'     THEN 8
  END;

  -- 3) Buscar prioridade do estado atual; só sobrescrever se o novo for >= atual
  SELECT CASE delivery_status
    WHEN 'sent'        THEN 1
    WHEN 'delayed'     THEN 2
    WHEN 'delivered'   THEN 3
    WHEN 'opened'      THEN 4
    WHEN 'clicked'     THEN 5
    WHEN 'complained'  THEN 6
    WHEN 'failed'      THEN 7
    WHEN 'bounced'     THEN 8
    ELSE 0
  END
  INTO v_current_priority
  FROM public.agent_messages
  WHERE id = v_message_id;

  IF v_priority >= COALESCE(v_current_priority, 0) THEN
    UPDATE public.agent_messages
    SET delivery_status    = v_new_status,
        delivery_status_at = NEW.occurred_at,
        delivery_meta      = COALESCE(delivery_meta, '{}'::jsonb)
                           || jsonb_build_object(
                                v_new_status, NEW.occurred_at,
                                'last_event_type', NEW.event_type
                              )
    WHERE id = v_message_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_email_event ON public.email_events;
CREATE TRIGGER trg_apply_email_event
  BEFORE INSERT ON public.email_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_apply_email_event_to_message();

-- ─── 4. RLS: leitura para usuários autenticados, escrita só service_role ──

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_email_events_read ON public.email_events;
CREATE POLICY p_email_events_read ON public.email_events
  FOR SELECT
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('comercial', 'gerente', 'admin')
    )
  );

DROP POLICY IF EXISTS p_email_events_write ON public.email_events;
CREATE POLICY p_email_events_write ON public.email_events
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Negar UPDATE e DELETE de qualquer role (eventos são imutáveis após inserção)
DROP POLICY IF EXISTS p_email_events_no_update ON public.email_events;
CREATE POLICY p_email_events_no_update ON public.email_events
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS p_email_events_no_delete ON public.email_events;
CREATE POLICY p_email_events_no_delete ON public.email_events
  FOR DELETE USING (false);

-- ─── 5. View consolidada por campanha (para o dashboard) ───────────────────

CREATE OR REPLACE VIEW public.vw_email_campanha_delivery AS
SELECT
  ac.id   AS campanha_id,
  ac.nome AS campanha_nome,
  COUNT(am.id)                                                     AS total_disparados,
  COUNT(*) FILTER (WHERE am.delivery_status = 'sent')              AS aceitos_resend,
  COUNT(*) FILTER (WHERE am.delivery_status = 'delivered')         AS entregues,
  COUNT(*) FILTER (WHERE am.delivery_status = 'opened')            AS abertos,
  COUNT(*) FILTER (WHERE am.delivery_status = 'clicked')           AS clicados,
  COUNT(*) FILTER (WHERE am.delivery_status = 'bounced')           AS bouncaram,
  COUNT(*) FILTER (WHERE am.delivery_status = 'complained')        AS reclamacoes,
  COUNT(*) FILTER (WHERE am.delivery_status = 'failed')            AS falharam,
  COUNT(*) FILTER (WHERE am.delivery_status IS NULL
                   AND am.status = 'enviada')                       AS sem_evento_ainda
FROM public.agent_campanhas ac
LEFT JOIN public.agent_messages am
  ON am.campanha_id = ac.id AND am.canal = 'email'
GROUP BY ac.id, ac.nome;

COMMENT ON VIEW public.vw_email_campanha_delivery IS
  'Métricas de entrega por campanha de email — consome agent_messages.delivery_status atualizado pelo webhook do Resend.';
