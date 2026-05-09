-- ============================================================================
-- 145 — Bloquear automaticamente leads cujo email deu bounce
-- ============================================================================
-- Ao receber email.bounced via webhook, marca o lead com "NAO INCLUIR" em
-- observacoes (que é como vw_leads_disparo deriva o flag bloqueado_disparo).
-- Protege a reputação do domínio impedindo reenvio pra emails inválidos.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_auto_block_lead_on_bounce()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead_id uuid;
BEGIN
  IF NEW.event_type <> 'email.bounced' THEN
    RETURN NEW;
  END IF;
  IF NEW.agent_message_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ac.lead_id INTO v_lead_id
  FROM agent_messages am
  JOIN agent_conversations ac ON ac.id = am.conversation_id
  WHERE am.id = NEW.agent_message_id;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE leads
  SET observacoes = COALESCE(observacoes || E'\n', '') ||
                    '[NAO INCLUIR — email bounced em ' || to_char(NEW.occurred_at, 'YYYY-MM-DD') || ']'
  WHERE id = v_lead_id
    AND COALESCE(observacoes, '') NOT ILIKE '%NAO INCLUIR%';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_block_lead_on_bounce ON public.email_events;
CREATE TRIGGER trg_auto_block_lead_on_bounce
  AFTER INSERT ON public.email_events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_block_lead_on_bounce();

COMMENT ON FUNCTION public.fn_auto_block_lead_on_bounce() IS
  'Quando chega email.bounced via webhook, marca o lead correspondente com NAO INCLUIR em observacoes. Protege reputação.';
