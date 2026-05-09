-- ============================================================================
-- 144 — Reconciliação Resend em 2 fases (enqueue → collect)
-- ============================================================================
-- Versão 143 era síncrona com pg_sleep — estourava statement_timeout. Esta
-- separa em 2 RPCs:
--   1. private.reconcile_resend_enqueue() — dispara http_get e registra request_id
--   2. private.reconcile_resend_collect() — coleta net._http_response e injeta
--      em public.email_events. Idempotente via UNIQUE INDEX.
--
-- Uso típico (precisa de RESEND_API_KEY com Full Access — a send-only retorna 401):
--   SELECT private.reconcile_resend_enqueue('2026-05-08'::date, 100);
--   -- aguardar 5-10s
--   SELECT * FROM private.reconcile_resend_collect();
--
-- Estado: uma key send-only retorna {"name":"restricted_api_key"}. Necessário
-- criar uma key com permissão GET no painel Resend.
-- ============================================================================

CREATE TABLE IF NOT EXISTS private.reconcile_pending (
  message_id   uuid PRIMARY KEY REFERENCES public.agent_messages(id) ON DELETE CASCADE,
  resend_id    text NOT NULL,
  request_id   bigint,
  enqueued_at  timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz,
  result       text,
  detail       text
);

-- ─── Fase 1: enqueue ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION private.reconcile_resend_enqueue(
  p_since date DEFAULT current_date,
  p_limit int  DEFAULT 100
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_api_key text;
  v_msg     record;
  v_req_id  bigint;
  v_count   int := 0;
BEGIN
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF v_api_key IS NULL OR v_api_key = '' THEN
    RAISE EXCEPTION 'RESEND_API_KEY ausente em vault.secrets';
  END IF;

  FOR v_msg IN
    SELECT am.id, am.metadata->>'resend_id' AS rid
    FROM public.agent_messages am
    LEFT JOIN private.reconcile_pending rp ON rp.message_id = am.id
    WHERE am.canal = 'email'
      AND am.created_at::date >= p_since
      AND am.metadata ? 'resend_id'
      AND rp.message_id IS NULL
    ORDER BY am.created_at ASC
    LIMIT p_limit
  LOOP
    SELECT net.http_get(
      url := 'https://api.resend.com/emails/' || v_msg.rid,
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key)
    ) INTO v_req_id;
    INSERT INTO private.reconcile_pending(message_id, resend_id, request_id)
    VALUES (v_msg.id, v_msg.rid, v_req_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_resend_enqueue(date, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_resend_enqueue(date, int) TO service_role;

-- ─── Fase 2: collect ──────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS private.reconcile_resend_collect();

CREATE FUNCTION private.reconcile_resend_collect()
RETURNS TABLE(
  out_message_id  uuid,
  out_resend_id   text,
  out_http_status int,
  out_last_event  text,
  out_result      text,
  out_detail      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_pend  record;
  v_resp  record;
  v_data  jsonb;
  v_status text;
  v_event  text;
  v_occurred timestamptz;
  v_result text;
  v_detail text;
BEGIN
  FOR v_pend IN
    SELECT rp.message_id, rp.resend_id, rp.request_id
    FROM private.reconcile_pending rp
    WHERE rp.collected_at IS NULL
  LOOP
    v_result := null; v_detail := null; v_status := null; v_event := null;
    SELECT * INTO v_resp FROM net._http_response WHERE id = v_pend.request_id;

    IF v_resp.id IS NULL THEN
      out_message_id := v_pend.message_id;
      out_resend_id  := v_pend.resend_id;
      out_http_status := 0;
      out_last_event := null;
      out_result := 'pending';
      out_detail := 'sem resposta — chamar collect novamente';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_resp.status_code <> 200 THEN
      v_result := 'http_error';
      v_detail := format('%s: %s', v_resp.status_code, left(v_resp.content, 200));
    ELSE
      BEGIN
        v_data := v_resp.content::jsonb;
        v_status := COALESCE(v_data->>'last_event', v_data->>'status');
        v_occurred := COALESCE(
          (v_data->>'last_event_at')::timestamptz,
          (v_data->>'created_at')::timestamptz, now()
        );
        v_event := CASE v_status
          WHEN 'sent' THEN 'email.sent'
          WHEN 'delivered' THEN 'email.delivered'
          WHEN 'delivery_delayed' THEN 'email.delivery_delayed'
          WHEN 'bounced' THEN 'email.bounced'
          WHEN 'complained' THEN 'email.complained'
          WHEN 'opened' THEN 'email.opened'
          WHEN 'clicked' THEN 'email.clicked'
          WHEN 'failed' THEN 'email.failed'
          ELSE NULL
        END;
        IF v_event IS NULL THEN
          v_result := 'unknown_status';
          v_detail := COALESCE(v_status, '(null)');
        ELSE
          BEGIN
            INSERT INTO public.email_events(
              resend_id, event_type, occurred_at, to_email, subject, payload
            ) VALUES (
              v_pend.resend_id, v_event, v_occurred,
              CASE jsonb_typeof(v_data->'to')
                WHEN 'array' THEN v_data->'to'->>0
                ELSE v_data->>'to'
              END,
              v_data->>'subject',
              jsonb_build_object('source','rpc-reconcile-v2','resend_response', v_data)
            );
            v_result := 'inserted';
            v_detail := v_event;
          EXCEPTION WHEN unique_violation THEN
            v_result := 'duplicate';
            v_detail := v_event;
          END;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_result := 'parse_error';
        v_detail := SQLERRM;
      END;
    END IF;

    UPDATE private.reconcile_pending rp
    SET collected_at = now(), result = v_result, detail = v_detail
    WHERE rp.message_id = v_pend.message_id;

    out_message_id := v_pend.message_id;
    out_resend_id  := v_pend.resend_id;
    out_http_status := v_resp.status_code;
    out_last_event := v_status;
    out_result := v_result;
    out_detail := v_detail;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_resend_collect() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_resend_collect() TO service_role;
