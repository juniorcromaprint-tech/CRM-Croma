-- ============================================================================
-- Migration 157: RPC contador de enviadas hoje + RPC limite diário efetivo
-- ============================================================================
--
-- Origem: bug diagnosticado em 2026-05-11. Contadores filtravam `status='enviada'`
-- e ignoravam mensagens que avançaram via webhook (entregue/lida/respondida).
-- Backend whatsapp-enviar tinha o mesmo bug → risco de estourar limite Meta
-- silenciosamente (em 11/05 foram 71 tentativas vs limite operacional 15).
--
-- Decisão arquitetural (Opção C):
--   - Rampa (fn_calcular_limite_diario) governa o crescimento natural
--   - max_contatos_dia (admin_config.agent_config) vira freio de mão / kill switch
--   - Limite efetivo = LEAST(rampa, max_contatos_dia)
--   - Frontend e backend usam a MESMA RPC → sem divergência
-- ============================================================================

-- ─── RPC 1: contador de mensagens efetivamente enviadas hoje ──────────────────
-- Inclui status que representam "passou pela porta" do Meta: enviada, entregue,
-- lida, respondida. Não conta erros (não consumiu cota efetiva).

CREATE OR REPLACE FUNCTION public.fn_contar_enviadas_hoje(p_canal text)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::int
  FROM public.agent_messages
  WHERE canal = p_canal
    AND status IN ('enviada','entregue','lida','respondida')
    AND enviado_em >= CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.fn_contar_enviadas_hoje(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_contar_enviadas_hoje(text) IS
  'Conta mensagens efetivamente enviadas hoje (status que representam sucesso no Meta).
   Inclui: enviada, entregue, lida, respondida. Exclui: erro, pendente, aprovada.
   Fonte única do contador "enviadas hoje" - usado por backend whatsapp-enviar e UI.';

-- ─── RPC 2: limite diário efetivo (LEAST de rampa e freio manual) ────────────
-- Lê max_contatos_dia do admin_config.agent_config (JSON em text).
-- Retorna LEAST(rampa_aquecimento, max_contatos_dia).
-- Se max_contatos_dia ausente/inválido → usa só a rampa.

CREATE OR REPLACE FUNCTION public.fn_limite_diario_efetivo()
RETURNS int
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rampa int;
  v_max   int;
  v_cfg   jsonb;
BEGIN
  v_rampa := public.fn_calcular_limite_diario();

  BEGIN
    SELECT valor::jsonb
      INTO v_cfg
    FROM public.admin_config
    WHERE chave = 'agent_config'
    LIMIT 1;
  EXCEPTION WHEN others THEN
    v_cfg := NULL;
  END;

  v_max := NULLIF(v_cfg->>'max_contatos_dia','')::int;

  IF v_max IS NULL OR v_max <= 0 THEN
    RETURN v_rampa;
  END IF;

  RETURN LEAST(v_rampa, v_max);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_limite_diario_efetivo() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.fn_limite_diario_efetivo() IS
  'Limite diário EFETIVO de envios WhatsApp. LEAST(rampa_aquecimento, max_contatos_dia).
   Rampa cresce sozinha (15→30→60→...). max_contatos_dia (admin_config) é freio manual.
   Para liberar a rampa: subir max_contatos_dia em /agent-config.
   Fonte única - usado por backend whatsapp-enviar e UI (banner /leads, card agente).';
