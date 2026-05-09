-- ============================================================================
-- 143 — RPC de reconciliação retroativa de eventos do Resend (versão 1)
-- ============================================================================
-- NOTA HISTÓRICA: esta versão estourava statement_timeout porque fazia pg_sleep
-- síncrono. Foi mantida no histórico mas SUBSTITUÍDA pela 144 (2 fases).
-- A função síncrona daqui pode ser usada para 1 mensagem isolada.
-- ============================================================================

CREATE OR REPLACE FUNCTION private.reconcile_resend_email_events(
  p_since date DEFAULT current_date,
  p_limit int  DEFAULT 100
)
RETURNS TABLE(
  message_id uuid,
  resend_id text,
  http_status int,
  last_event text,
  inserted boolean,
  error_msg text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_api_key text;
  v_msg     record;
  v_req_id  bigint;
  v_resp    record;
  v_data    jsonb;
  v_status  text;
  v_event   text;
  v_occurred timestamptz;
  v_inserted boolean;
  v_err     text;
BEGIN
  SELECT decrypted_secret INTO v_api_key
  FROM vault.decrypted_secrets WHERE name = 'RESEND_API_KEY' LIMIT 1;
  IF v_api_key IS NULL OR v_api_key = '' THEN
    RAISE EXCEPTION 'RESEND_API_KEY não está em vault.secrets';
  END IF;

  FOR v_msg IN
    SELECT am.id, am.metadata->>'resend_id' AS rid
    FROM public.agent_messages am
    WHERE am.canal = 'email'
      AND am.created_at::date >= p_since
      AND am.metadata ? 'resend_id'
    ORDER BY am.created_at ASC
    LIMIT p_limit
  LOOP
    v_inserted := false; v_err := null; v_status := null; v_event := null;

    BEGIN
      SELECT net.http_get(
        url := 'https://api.resend.com/emails/' || v_msg.rid,
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key)
      ) INTO v_req_id;

      FOR i IN 1..50 LOOP
        SELECT * INTO v_resp FROM net._http_response WHERE id = v_req_id;
        EXIT WHEN v_resp.id IS NOT NULL;
        PERFORM pg_sleep(0.1);
      END LOOP;

      IF v_resp.id IS NULL THEN
        v_err := 'pg_net timeout';
      ELSIF v_resp.status_code <> 200 THEN
        v_err := format('http %s: %s', v_resp.status_code, left(v_resp.content, 200));
      ELSE
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
          v_err := 'status desconhecido: ' || COALESCE(v_status, '(null)');
        ELSE
          BEGIN
            INSERT INTO public.email_events(resend_id, event_type, occurred_at, to_email, subject, payload)
            VALUES (v_msg.rid, v_event, v_occurred,
              CASE jsonb_typeof(v_data->'to') WHEN 'array' THEN v_data->'to'->>0 ELSE v_data->>'to' END,
              v_data->>'subject',
              jsonb_build_object('source','rpc-reconcile','resend_response', v_data));
            v_inserted := true;
          EXCEPTION WHEN unique_violation THEN
            v_inserted := false; v_err := 'já existia (dedup)';
          END;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_err := SQLERRM;
    END;

    message_id := v_msg.id; resend_id := v_msg.rid;
    http_status := COALESCE(v_resp.status_code, 0);
    last_event := v_status; inserted := v_inserted; error_msg := v_err;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION private.reconcile_resend_email_events(date, int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.reconcile_resend_email_events(date, int) TO service_role;
