-- =========================================================================
-- Migration 156 — Auto-deteccao de numeros sem WhatsApp ativo
--
-- NOTA: aplicada no banco com o nome "151_auto_marcar_whatsapp_invalido"
-- (timestamp 20260511141021), mas o numero 151 ja existe como arquivo no repo
-- (151_vw_proxima_campanha_calcados_30_refined.sql). Mantendo o numero do
-- arquivo cronologico (156) pra evitar colisao de nomenclatura.
--
-- Objetivo: quando a Meta confirma que um numero nao tem WhatsApp (codigo
-- 131026 / "Message undeliverable"), marcar o lead pra nunca mais tentar
-- WhatsApp, mas manter elegivel pra Email (se tiver email).
--
-- Origem: campanha 2026-05-11 teve 45% taxa de erro (37 de 89 msgs). Maioria
-- eram fixos comerciais raspados do Google Maps que nao tem WhatsApp ativo.
-- =========================================================================

-- 1. agent_messages: capturar codigo + detalhes do erro Meta
ALTER TABLE public.agent_messages
  ADD COLUMN IF NOT EXISTS erro_codigo text,
  ADD COLUMN IF NOT EXISTS erro_detalhes text;

COMMENT ON COLUMN public.agent_messages.erro_codigo IS
  'Codigo de erro da Meta WhatsApp Cloud API (ex: 131026=undeliverable). NULL pra erros legados pre-v26.';
COMMENT ON COLUMN public.agent_messages.erro_detalhes IS
  'errors[0].error_data.details OU errors[0].title da Meta — descricao mais especifica do erro.';

CREATE INDEX IF NOT EXISTS idx_agent_messages_erro_codigo
  ON public.agent_messages(erro_codigo) WHERE erro_codigo IS NOT NULL;

-- 2. leads: flag de invalidacao WhatsApp
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS whatsapp_invalido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_invalidado_em timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_invalidado_motivo text;

COMMENT ON COLUMN public.leads.whatsapp_invalido IS
  'true = lead confirmadamente sem WhatsApp ativo (apos N falhas permanentes). Lead continua elegivel pra email.';
COMMENT ON COLUMN public.leads.whatsapp_invalidado_motivo IS
  'Texto explicando por que foi marcado (ex: "auto:2_falhas_permanentes"). Util pra auditoria.';

CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_invalido
  ON public.leads(whatsapp_invalido) WHERE whatsapp_invalido = true;

-- 3. Classificador: quais codigos Meta indicam "numero permanentemente invalido"
CREATE OR REPLACE FUNCTION private.fn_codigo_meta_eh_permanente(p_codigo text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  -- SO codigos que indicam "numero nao tem WhatsApp" ou "telefone permanentemente invalido".
  -- NAO inclui: 131047 (re-engagement window), 131049 (quality filter), 131016 (service down),
  -- 131056 (rate limit), 131031 (account restricted — problema da nossa conta), 131005 (auth).
  -- Referencias: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
  SELECT p_codigo IN (
    '131026'  -- Message undeliverable: receiver nao tem WhatsApp account / canal bloqueado
    -- 131009 (parameter invalid) NAO incluido — pode ser telefone mal formado e correvel.
  );
$$;

COMMENT ON FUNCTION private.fn_codigo_meta_eh_permanente IS
  'Retorna true se codigo Meta indica numero permanentemente fora do WhatsApp.';

-- 4. RPC principal: auto-marcar leads sem WhatsApp
CREATE OR REPLACE FUNCTION private.fn_auto_marcar_sem_whatsapp(
  p_min_tentativas int DEFAULT 2,
  p_dry_run boolean DEFAULT false
) RETURNS TABLE(leads_marcados int, lead_ids uuid[])
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  -- Identifica leads com N+ falhas permanentes E nenhum sucesso historico.
  -- Guardas:
  --  - excluido_em IS NULL: lead ativo
  --  - whatsapp_invalido = false: nao re-marcar quem ja foi
  --  - sucesso_count = 0: NUNCA marcar lead que ja conseguiu enviar uma vez
  --  - Aceita 2 origens de "falha permanente":
  --      a) erro_codigo eh permanente (futuro, pos-v2 webhook)
  --      b) erro_codigo NULL E erro_mensagem ILIKE '%undeliverable%' (legado historico)
  WITH alvos AS (
    SELECT ac.lead_id
    FROM public.agent_messages am
    JOIN public.agent_conversations ac ON ac.id = am.conversation_id
    JOIN public.leads l ON l.id = ac.lead_id
    WHERE am.canal = 'whatsapp'
      AND am.status = 'erro'
      AND l.excluido_em IS NULL
      AND l.whatsapp_invalido = false
      AND (
        (am.erro_codigo IS NOT NULL AND private.fn_codigo_meta_eh_permanente(am.erro_codigo))
        OR (am.erro_codigo IS NULL AND am.erro_mensagem ILIKE '%undeliverable%')
      )
    GROUP BY ac.lead_id
    HAVING COUNT(*) >= p_min_tentativas
       AND (
         SELECT COUNT(*) FROM public.agent_messages am2
         JOIN public.agent_conversations ac2 ON ac2.id = am2.conversation_id
         WHERE ac2.lead_id = ac.lead_id
           AND am2.canal = 'whatsapp'
           AND am2.status IN ('enviada','entregue','lida','respondida')
       ) = 0
  )
  SELECT COALESCE(array_agg(lead_id), ARRAY[]::uuid[]) INTO v_ids FROM alvos;

  IF p_dry_run OR v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN QUERY SELECT COALESCE(array_length(v_ids,1), 0), COALESCE(v_ids, ARRAY[]::uuid[]);
    RETURN;
  END IF;

  UPDATE public.leads
  SET whatsapp_invalido = true,
      whatsapp_invalidado_em = now(),
      whatsapp_invalidado_motivo = 'auto:' || p_min_tentativas || '_falhas_permanentes'
  WHERE id = ANY(v_ids);

  RETURN QUERY SELECT array_length(v_ids,1), v_ids;
END;
$$;

COMMENT ON FUNCTION private.fn_auto_marcar_sem_whatsapp IS
  'Marca leads com N+ falhas WhatsApp permanentes como whatsapp_invalido=true. p_dry_run=true so retorna a lista sem aplicar.';

-- 5. View vw_leads_disparo: cruzar whatsapp_invalido com tem_telefone_valido
-- Veja banco para versao completa (CREATE OR REPLACE foi aplicado com 100% do SELECT original
-- + condicao AND NOT COALESCE(l.whatsapp_invalido, false) em tem_telefone_valido +
-- nova coluna explicita whatsapp_invalido pra UI).

-- 6. Agendamento cron diario 6h BRT (9h UTC) — antes da janela de campanhas BRT 9-12h
DO $$
BEGIN
  PERFORM cron.unschedule('auto-marcar-sem-whatsapp-diario');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'auto-marcar-sem-whatsapp-diario',
  '0 9 * * *',
  $cron$SELECT private.fn_auto_marcar_sem_whatsapp(2, false);$cron$
);

-- 7. Batch retroativo (executado uma vez em 2026-05-11)
-- Marcou 71 leads historicos com 1+ falha "Message undeliverable":
-- SELECT * FROM private.fn_auto_marcar_sem_whatsapp(1, false);
