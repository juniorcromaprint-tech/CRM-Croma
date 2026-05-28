-- 20260527_portal_notif_vendedor_cliente_update.sql
-- BLOCO 4D — Notificar vendedor quando cliente edita dados via portal /p/:token.
--
-- O QUE FAZ:
-- 1. Adiciona profiles.telegram_chat_id (BIGINT, nullable) — mapeamento vendedor -> Telegram.
-- 2. Cria tabela portal_alteracoes_cliente para audit log das mudancas.
-- 3. Cria trigger AFTER UPDATE em clientes que:
--    a) detecta mudanca em campos editaveis pelo portal (whitelist do portal_atualizar_cliente),
--    b) registra diff em portal_alteracoes_cliente,
--    c) dispara Telegram pro vendedor responsavel (cliente.vendedor_id ou vendedor da proposta mais recente).
--
-- DESIGN:
-- - Trigger NUNCA bloqueia o UPDATE (BEGIN/EXCEPTION wrapping cada side-effect).
-- - Fallback chat_id hardcoded (Junior = 1065519625) se vendedor sem telegram_chat_id.
-- - pg_net.http_post async (nao bloqueia transacao).
-- - Migration totalmente idempotente.

-- ============================================================================
-- 1) profiles.telegram_chat_id
-- ============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;

COMMENT ON COLUMN public.profiles.telegram_chat_id IS
  'Telegram chat_id para notificacoes 1:1 ao usuario. NULL = usa fallback admin.';

-- Seed: Junior (proprietario, admin do bot) ja tem chat_id conhecido = 1065519625.
UPDATE public.profiles
SET telegram_chat_id = 1065519625
WHERE email = 'junior.cromaprint@gmail.com'
  AND telegram_chat_id IS NULL;

-- ============================================================================
-- 2) portal_alteracoes_cliente (audit log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.portal_alteracoes_cliente (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL,
  proposta_id     UUID,
  vendedor_id     UUID,
  campos_alterados JSONB NOT NULL,
  ip              TEXT,
  user_agent      TEXT,
  telegram_chat_id BIGINT,
  telegram_dispatched BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pac_cliente_id
  ON public.portal_alteracoes_cliente (cliente_id);
CREATE INDEX IF NOT EXISTS idx_pac_proposta_id
  ON public.portal_alteracoes_cliente (proposta_id);
CREATE INDEX IF NOT EXISTS idx_pac_created_at_desc
  ON public.portal_alteracoes_cliente (created_at DESC);

ALTER TABLE public.portal_alteracoes_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pac_service_role_all ON public.portal_alteracoes_cliente;
CREATE POLICY pac_service_role_all
  ON public.portal_alteracoes_cliente
  AS PERMISSIVE
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Permite admin/vendedor autenticado ler (sem write — write so via trigger SECURITY DEFINER).
DROP POLICY IF EXISTS pac_authenticated_read ON public.portal_alteracoes_cliente;
CREATE POLICY pac_authenticated_read
  ON public.portal_alteracoes_cliente
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 3) Trigger function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_vendedor_cliente_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_diff           JSONB := '{}'::jsonb;
  v_vendedor_id    UUID;
  v_proposta_id    UUID;
  v_proposta_num   TEXT;
  v_chat_id        BIGINT;
  v_token          TEXT;
  v_msg            TEXT;
  v_audit_id       UUID;
  v_dispatched     BOOLEAN := FALSE;
  v_fallback_chat  CONSTANT BIGINT := 1065519625; -- Junior
BEGIN
  -- ----------------------------------------------------------------------
  -- 1) Detectar diff nos campos editaveis pelo portal
  --    (mesma whitelist do portal_atualizar_cliente).
  -- ----------------------------------------------------------------------
  IF NEW.cep IS DISTINCT FROM OLD.cep THEN
    v_diff := v_diff || jsonb_build_object('cep', jsonb_build_object('de', OLD.cep, 'para', NEW.cep));
  END IF;
  IF NEW.endereco IS DISTINCT FROM OLD.endereco THEN
    v_diff := v_diff || jsonb_build_object('endereco', jsonb_build_object('de', OLD.endereco, 'para', NEW.endereco));
  END IF;
  IF NEW.numero IS DISTINCT FROM OLD.numero THEN
    v_diff := v_diff || jsonb_build_object('numero', jsonb_build_object('de', OLD.numero, 'para', NEW.numero));
  END IF;
  IF NEW.complemento IS DISTINCT FROM OLD.complemento THEN
    v_diff := v_diff || jsonb_build_object('complemento', jsonb_build_object('de', OLD.complemento, 'para', NEW.complemento));
  END IF;
  IF NEW.bairro IS DISTINCT FROM OLD.bairro THEN
    v_diff := v_diff || jsonb_build_object('bairro', jsonb_build_object('de', OLD.bairro, 'para', NEW.bairro));
  END IF;
  IF NEW.cidade IS DISTINCT FROM OLD.cidade THEN
    v_diff := v_diff || jsonb_build_object('cidade', jsonb_build_object('de', OLD.cidade, 'para', NEW.cidade));
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    v_diff := v_diff || jsonb_build_object('estado', jsonb_build_object('de', OLD.estado, 'para', NEW.estado));
  END IF;
  IF NEW.telefone IS DISTINCT FROM OLD.telefone THEN
    v_diff := v_diff || jsonb_build_object('telefone', jsonb_build_object('de', OLD.telefone, 'para', NEW.telefone));
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    v_diff := v_diff || jsonb_build_object('email', jsonb_build_object('de', OLD.email, 'para', NEW.email));
  END IF;
  IF NEW.contato_financeiro IS DISTINCT FROM OLD.contato_financeiro THEN
    v_diff := v_diff || jsonb_build_object('contato_financeiro', jsonb_build_object('de', OLD.contato_financeiro, 'para', NEW.contato_financeiro));
  END IF;

  -- Sem mudanca em campos relevantes -> nao faz nada (evita spam em outros UPDATEs).
  IF v_diff = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- ----------------------------------------------------------------------
  -- 2) Resolver vendedor + proposta ativa (mais recente).
  -- ----------------------------------------------------------------------
  BEGIN
    SELECT p.id, p.vendedor_id, p.numero::text
      INTO v_proposta_id, v_vendedor_id, v_proposta_num
    FROM public.propostas p
    WHERE p.cliente_id = NEW.id
    ORDER BY p.created_at DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_proposta_id := NULL;
    v_vendedor_id := NULL;
    v_proposta_num := NULL;
  END;

  -- Fallback: vendedor direto na ficha do cliente.
  IF v_vendedor_id IS NULL THEN
    v_vendedor_id := NEW.vendedor_id;
  END IF;

  -- ----------------------------------------------------------------------
  -- 3) Resolver telegram_chat_id (vendedor -> profiles, ou fallback Junior).
  -- ----------------------------------------------------------------------
  IF v_vendedor_id IS NOT NULL THEN
    BEGIN
      SELECT telegram_chat_id INTO v_chat_id
      FROM public.profiles
      WHERE id = v_vendedor_id
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_chat_id := NULL;
    END;
  END IF;

  IF v_chat_id IS NULL THEN
    v_chat_id := v_fallback_chat;
  END IF;

  -- ----------------------------------------------------------------------
  -- 4) Audit log (sempre tenta, mesmo se Telegram falhar).
  -- ----------------------------------------------------------------------
  BEGIN
    INSERT INTO public.portal_alteracoes_cliente
      (cliente_id, proposta_id, vendedor_id, campos_alterados, telegram_chat_id)
    VALUES
      (NEW.id, v_proposta_id, v_vendedor_id, v_diff, v_chat_id)
    RETURNING id INTO v_audit_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_vendedor_cliente_update] audit insert falhou: %', SQLERRM;
  END;

  -- ----------------------------------------------------------------------
  -- 5) Disparar Telegram via pg_net (async, nunca quebra o UPDATE).
  -- ----------------------------------------------------------------------
  BEGIN
    SELECT public.get_telegram_bot_token() INTO v_token;

    IF v_token IS NULL OR v_token = '' THEN
      RAISE NOTICE '[notify_vendedor_cliente_update] TELEGRAM_BOT_TOKEN ausente, pulando notificacao';
    ELSE
      v_msg := E'[PORTAL] Cliente atualizou cadastro\n'
            || E'Cliente: ' || COALESCE(NEW.razao_social, NEW.nome_fantasia, NEW.id::text) || E'\n'
            || CASE WHEN v_proposta_num IS NOT NULL
                    THEN E'Proposta: #' || v_proposta_num || E'\n'
                    ELSE '' END
            || E'Alteracoes:\n' || jsonb_pretty(v_diff);

      PERFORM net.http_post(
        url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
        body    := jsonb_build_object(
                     'chat_id', v_chat_id,
                     'text', v_msg,
                     'disable_web_page_preview', true
                   ),
        headers := jsonb_build_object('Content-Type', 'application/json')
      );
      v_dispatched := TRUE;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[notify_vendedor_cliente_update] telegram dispatch falhou: %', SQLERRM;
  END;

  -- Marca dispatched=true se chegou ate aqui sem excecao.
  IF v_dispatched AND v_audit_id IS NOT NULL THEN
    BEGIN
      UPDATE public.portal_alteracoes_cliente
      SET telegram_dispatched = TRUE
      WHERE id = v_audit_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4) Trigger binding (idempotente)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_notify_vendedor_cliente_update ON public.clientes;
CREATE TRIGGER trg_notify_vendedor_cliente_update
  AFTER UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_vendedor_cliente_update();

COMMENT ON FUNCTION public.notify_vendedor_cliente_update() IS
  'BLOCO 4D — Notifica vendedor via Telegram quando cliente edita cadastro via portal /p/:token. Wrap em EXCEPTION para nunca bloquear o UPDATE base.';
