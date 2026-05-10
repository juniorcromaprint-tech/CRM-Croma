-- Migration 155: notificacao Telegram quando email é aberto/clicado
--
-- Trigger em email_events que dispara mensagem pro chat_id do Junior (1065519625)
-- via Telegram Bot API quando event_type IN ('email.opened', 'email.clicked').
--
-- DEPENDENCIA: vault precisa ter o secret 'TELEGRAM_BOT_TOKEN' setado.
-- Como adicionar: dashboard Supabase -> Project Settings -> Vault -> Add new secret.
--
-- Sem o token, a trigger NAO falha — apenas loga e ignora.
-- Anti-spam: ignora multiple opens do mesmo lead em <30min.

CREATE OR REPLACE FUNCTION public.fn_notify_telegram_email_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
  v_chat_id text := '1065519625';
  v_msg agent_messages%ROWTYPE;
  v_lead leads%ROWTYPE;
  v_text text;
  v_emoji text;
  v_already_notified boolean;
BEGIN
  IF NEW.event_type NOT IN ('email.opened', 'email.clicked') THEN RETURN NEW; END IF;

  BEGIN
    SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'TELEGRAM_BOT_TOKEN' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF v_token IS NULL OR v_token = '' THEN RETURN NEW; END IF;

  SELECT * INTO v_msg FROM public.agent_messages WHERE id = NEW.agent_message_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT l.* INTO v_lead FROM public.leads l
  JOIN public.agent_conversations ac ON ac.lead_id = l.id WHERE ac.id = v_msg.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.email_events ee2
    JOIN public.agent_messages am2 ON am2.id = ee2.agent_message_id
    JOIN public.agent_conversations ac2 ON ac2.id = am2.conversation_id
    WHERE ac2.lead_id = v_lead.id AND ee2.event_type = NEW.event_type
      AND ee2.created_at > now() - interval '30 minutes' AND ee2.id <> NEW.id
  ) INTO v_already_notified;
  IF v_already_notified THEN RETURN NEW; END IF;

  v_emoji := CASE NEW.event_type WHEN 'email.opened' THEN '📧' WHEN 'email.clicked' THEN '🎯' END;
  v_text := v_emoji || ' *' || CASE NEW.event_type WHEN 'email.opened' THEN 'ABRIU' ELSE 'CLICOU' END || '*' || E'\n\n' ||
    '🏢 ' || COALESCE(v_lead.empresa, 'sem empresa') || E'\n' ||
    '👤 ' || COALESCE(v_lead.contato_nome, 'contato sem nome') || E'\n' ||
    '✉️ ' || v_lead.contato_email || E'\n' ||
    '📋 ' || COALESCE(v_msg.assunto, 'sem assunto');

  PERFORM net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('chat_id', v_chat_id, 'text', v_text, 'parse_mode', 'Markdown')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_email_event ON public.email_events;
CREATE TRIGGER trg_notify_telegram_email_event
  AFTER INSERT ON public.email_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_telegram_email_event();

COMMENT ON FUNCTION public.fn_notify_telegram_email_event() IS
'Trigger AFTER INSERT em email_events. Quando event_type IN (email.opened, email.clicked) e existe TELEGRAM_BOT_TOKEN no vault, envia notificacao pro Junior. Anti-spam 30min. Falha graceful.';
