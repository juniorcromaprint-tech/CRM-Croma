-- Fase 2.3 do plano CROMA 4.0 — agent_config (unico gap real confirmado ciclo autonomo #7)
-- Aplicada via MCP `apply_migration` em 2026-05-28 ciclo autonomo #8.
-- Tabela de configuracao centralizada do agente comercial (chave-valor + jsonb flexivel).
-- Padrao consistente com agent_templates/agent_rules: RLS on, service_role ALL, authenticated SELECT.

CREATE TABLE IF NOT EXISTS public.agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL,
  categoria text NOT NULL DEFAULT 'geral',
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_config_chave ON public.agent_config(chave);
CREATE INDEX IF NOT EXISTS idx_agent_config_categoria_ativo ON public.agent_config(categoria, ativo);

-- RLS (padrao Fase 2)
ALTER TABLE public.agent_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid='public.agent_config'::regclass AND polname='agent_config_service_role_all'
  ) THEN
    EXECUTE 'CREATE POLICY agent_config_service_role_all ON public.agent_config TO service_role USING (true) WITH CHECK (true)';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polrelid='public.agent_config'::regclass AND polname='agent_config_authenticated_select'
  ) THEN
    EXECUTE 'CREATE POLICY agent_config_authenticated_select ON public.agent_config FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- Trigger updated_at idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname='fn_agent_config_touch_updated_at'
  ) THEN
    CREATE OR REPLACE FUNCTION public.fn_agent_config_touch_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_agent_config_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_agent_config_touch_updated_at
      BEFORE UPDATE ON public.agent_config
      FOR EACH ROW EXECUTE FUNCTION public.fn_agent_config_touch_updated_at();
  END IF;
END $$;

-- Seed minimo idempotente (ON CONFLICT DO NOTHING via chave UNIQUE)
INSERT INTO public.agent_config (chave, valor, categoria, descricao) VALUES
  ('modelo_default',       '{"model":"claude-sonnet-4-5-20250929","provider":"anthropic"}'::jsonb, 'modelo', 'Modelo padrao para respostas do agente comercial WhatsApp/email'),
  ('modelo_fallback',      '{"model":"claude-haiku-4-5-20251001","provider":"anthropic"}'::jsonb, 'modelo', 'Modelo barato/rapido para qualificacao e classificacao'),
  ('modelo_visao',         '{"model":"claude-sonnet-4-5-20250929","provider":"anthropic"}'::jsonb, 'modelo', 'Modelo com visao para analise de fotos (foto instalacao, briefing)'),
  ('tom_padrao',           '{"tom":"profissional_caloroso","instrucao":"Direto, sem floreios. Pt-BR brasileiro coloquial. Sem emoji exagerado. Trate o cliente pelo primeiro nome quando souber."}'::jsonb, 'tom', 'Tom default das mensagens do agente comercial'),
  ('max_tokens_resposta',  '{"valor":2048}'::jsonb, 'limites', 'Max tokens por resposta do agente'),
  ('temperatura_default',  '{"valor":0.7}'::jsonb, 'limites', 'Temperatura LLM padrao para mensagens comerciais'),
  ('temperatura_decisao',  '{"valor":0.2}'::jsonb, 'limites', 'Temperatura LLM para decisoes determinísticas (qualificacao, classificacao, intent)'),
  ('janela_horaria_envio', '{"inicio":"08:00","fim":"20:00","timezone":"America/Sao_Paulo","ignorar_fins_de_semana":false}'::jsonb, 'guardrails', 'Janela permitida para disparos automaticos ao cliente'),
  ('limite_msgs_dia_lead', '{"valor":3}'::jsonb, 'guardrails', 'Maximo de mensagens automaticas por dia por lead (anti-spam)'),
  ('cooldown_min',         '{"valor":30}'::jsonb, 'guardrails', 'Cooldown minimo em minutos entre mensagens automaticas para o mesmo lead'),
  ('require_human_approval_orcamento', '{"valor":true,"threshold_valor_brl":10000}'::jsonb, 'guardrails', 'Exige aprovacao Junior/Viviane antes de enviar proposta acima do threshold (R$)'),
  ('chat_id_telegram_dono','{"chat_id":"1065519625"}'::jsonb, 'integracoes', 'chat_id Telegram do Junior (notificacoes administrativas)')
ON CONFLICT (chave) DO NOTHING;

REVOKE ALL ON public.agent_config FROM PUBLIC;
GRANT SELECT ON public.agent_config TO authenticated;
GRANT ALL ON public.agent_config TO service_role;

COMMENT ON TABLE public.agent_config IS 'Fase 2.3 CROMA 4.0 — configuracao centralizada do agente comercial (modelo, tom, limites, guardrails). Criada 2026-05-28 ciclo autonomo #8.';
COMMENT ON COLUMN public.agent_config.chave IS 'Identificador unico da configuracao (snake_case)';
COMMENT ON COLUMN public.agent_config.valor IS 'Valor flexivel em jsonb (string/number/object/array)';
COMMENT ON COLUMN public.agent_config.categoria IS 'Grupo: modelo, tom, limites, guardrails, integracoes, geral';
