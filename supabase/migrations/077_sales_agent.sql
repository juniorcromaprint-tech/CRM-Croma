-- ============================================================
-- Migration 077 — Agente de Vendas: tabelas base
-- Criado: 2026-03-19
-- ============================================================

-- ============================================================
-- 1. TABELA agent_conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_conversations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id              UUID        NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  canal                TEXT        NOT NULL CHECK (canal IN ('email', 'whatsapp', 'interno')),
  status               TEXT        NOT NULL DEFAULT 'ativa'
                                   CHECK (status IN ('ativa', 'pausada', 'aguardando_aprovacao', 'convertida', 'encerrada')),
  etapa                TEXT        NOT NULL DEFAULT 'abertura'
                                   CHECK (etapa IN ('abertura', 'followup1', 'followup2', 'followup3', 'reengajamento', 'proposta', 'negociacao')),
  mensagens_enviadas   INT         NOT NULL DEFAULT 0,
  mensagens_recebidas  INT         NOT NULL DEFAULT 0,
  ultima_mensagem_em   TIMESTAMPTZ,
  proximo_followup     TIMESTAMPTZ,
  tentativas           INT         NOT NULL DEFAULT 0,
  max_tentativas       INT         NOT NULL DEFAULT 5,
  score_engajamento    INT         NOT NULL DEFAULT 0,
  metadata             JSONB                 DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. TABELA agent_messages
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_messages (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID        NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  direcao          TEXT        NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
  canal            TEXT        NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  conteudo         TEXT        NOT NULL,
  assunto          TEXT,
  metadata         JSONB                 DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'rascunho'
                               CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovada', 'enviada', 'entregue', 'lida', 'respondida', 'erro')),
  aprovado_por     UUID        REFERENCES profiles(id),
  aprovado_em      TIMESTAMPTZ,
  enviado_em       TIMESTAMPTZ,
  lido_em          TIMESTAMPTZ,
  respondido_em    TIMESTAMPTZ,
  erro_mensagem    TEXT,
  custo_ia         NUMERIC(10,6)         DEFAULT 0,
  modelo_ia        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. TABELA agent_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_templates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  segmento      TEXT,
  canal         TEXT        NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  etapa         TEXT        NOT NULL CHECK (etapa IN ('abertura', 'followup1', 'followup2', 'followup3', 'reengajamento', 'proposta')),
  assunto       TEXT,
  conteudo      TEXT        NOT NULL,
  variaveis     TEXT[]               DEFAULT '{}',
  ativo         BOOLEAN     NOT NULL DEFAULT true,
  vezes_usado   INT         NOT NULL DEFAULT 0,
  taxa_resposta NUMERIC(5,2)         DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agent_conv_lead
  ON agent_conversations(lead_id);

CREATE INDEX IF NOT EXISTS idx_agent_conv_status
  ON agent_conversations(status);

CREATE INDEX IF NOT EXISTS idx_agent_conv_proximo
  ON agent_conversations(proximo_followup)
  WHERE status = 'ativa';

CREATE INDEX IF NOT EXISTS idx_agent_msg_conv
  ON agent_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_msg_status
  ON agent_messages(status)
  WHERE status IN ('pendente_aprovacao', 'rascunho');

CREATE INDEX IF NOT EXISTS idx_agent_tpl_canal_etapa
  ON agent_templates(canal, etapa)
  WHERE ativo = true;

-- ============================================================
-- 5. RLS
-- ============================================================
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates     ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_conversations_authenticated
  ON agent_conversations FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY agent_messages_authenticated
  ON agent_messages FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY agent_templates_authenticated
  ON agent_templates FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- 6. TRIGGERS updated_at
-- ============================================================
CREATE TRIGGER trg_agent_conversations_updated_at
  BEFORE UPDATE ON agent_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_agent_templates_updated_at
  BEFORE UPDATE ON agent_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 7. SEED: configuração do agente em admin_config
-- ============================================================
INSERT INTO admin_config (chave, valor, descricao)
VALUES (
  'agent_config',
  '{
    "max_contatos_dia": 20,
    "horario_inicio": "08:00",
    "horario_fim": "18:00",
    "dias_entre_followup": 3,
    "max_tentativas": 5,
    "canais_ativos": ["email"],
    "segmentos_ativos": ["varejo", "franquia", "industria"],
    "tom": "consultivo",
    "modelo_qualificacao": "openai/gpt-4.1-mini",
    "modelo_composicao": "anthropic/claude-sonnet-4",
    "email_remetente": "comercial@cromaprint.com.br",
    "nome_remetente": "Croma Print"
  }',
  'Configuração do Agente de Vendas IA'
)
ON CONFLICT (chave) DO NOTHING;
