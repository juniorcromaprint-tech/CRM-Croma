-- Migration 104: AI Bridge (ai_requests/ai_responses) + Event Triggers Formais
-- CROMA 4.0 — Infraestrutura de Autonomia
-- Data: 2026-03-29

-- ═══════════════════════════════════════════════════
-- PARTE 1: PONTE MCP (ai_requests / ai_responses)
-- Permite que botões do ERP enviem requests para Claude
-- processar via MCP, com fallback para OpenRouter
-- ═══════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,                    -- 'analisar-orcamento', 'detectar-problemas', 'resumo-cliente', etc.
  entity_type TEXT NOT NULL,             -- 'proposta', 'pedido', 'cliente', 'lead', 'geral'
  entity_id UUID,                        -- ID da entidade alvo (nullable para requests genéricos)
  contexto JSONB DEFAULT '{}',           -- dados extras para o processamento
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, error, expired
  solicitante_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT now() + interval '1 hour',
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS ai_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES ai_requests(id) ON DELETE CASCADE,
  conteudo JSONB NOT NULL,               -- resposta estruturada
  actions JSONB DEFAULT '[]',            -- ações aplicáveis (appliers compatíveis com AIActionV2)
  summary TEXT,                          -- resumo textual da resposta
  model_used TEXT DEFAULT 'claude',
  tokens_used INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  duration_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para polling eficiente
CREATE INDEX IF NOT EXISTS idx_ai_requests_status ON ai_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ai_requests_tipo ON ai_requests(tipo);
CREATE INDEX IF NOT EXISTS idx_ai_requests_created ON ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_responses_request ON ai_responses(request_id);

-- RLS
ALTER TABLE ai_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;

-- Authenticated users podem criar requests e ver seus próprios
CREATE POLICY "ai_requests_insert" ON ai_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "ai_requests_select" ON ai_requests FOR SELECT TO authenticated
  USING (auth.uid() = solicitante_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente')
  ));

-- Service role pode fazer tudo (para Claude/Edge Functions processarem)
CREATE POLICY "ai_requests_service" ON ai_requests FOR ALL TO service_role USING (true);
CREATE POLICY "ai_responses_service" ON ai_responses FOR ALL TO service_role USING (true);

-- Authenticated users podem ver responses dos seus requests
CREATE POLICY "ai_responses_select" ON ai_responses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ai_requests WHERE ai_requests.id = ai_responses.request_id
      AND (ai_requests.solicitante_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'gerente')
      ))
  ));

-- Auto-expirar requests velhos (função para job)
CREATE OR REPLACE FUNCTION fn_expire_ai_requests()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE ai_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$;

-- ═══════════════════════════════════════════════════
-- PARTE 2: TRIGGERS DE EVENTOS FORMAIS
-- Completam a cadeia de automação do fluxo
-- ═══════════════════════════════════════════════════

-- Tabela de eventos do sistema (para auditoria e automação)
CREATE TABLE IF NOT EXISTS system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,              -- 'production_completed', 'installation_completed', etc.
  entity_type TEXT NOT NULL,             -- 'ordem_producao', 'pedido', 'conta_receber'
  entity_id UUID NOT NULL,
  payload JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_events_type ON system_events(event_type);
CREATE INDEX IF NOT EXISTS idx_system_events_pending ON system_events(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_system_events_created ON system_events(created_at DESC);

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_events_service" ON system_events FOR ALL TO service_role USING (true);
CREATE POLICY "system_events_select" ON system_events FOR SELECT TO authenticated USING (true);

-- ───────────────────────────────────────
-- TRIGGER 1: production_completed
-- Dispara quando TODAS as etapas de uma OP estão concluídas
-- ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_check_production_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_op_id UUID;
  v_total_etapas INT;
  v_etapas_concluidas INT;
  v_pedido_id UUID;
BEGIN
  -- Busca a OP desta etapa
  v_op_id := NEW.ordem_producao_id;

  -- Conta etapas totais vs concluídas
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'concluido')
  INTO v_total_etapas, v_etapas_concluidas
  FROM op_etapas
  WHERE ordem_producao_id = v_op_id;

  -- Se todas concluídas, dispara evento
  IF v_total_etapas > 0 AND v_total_etapas = v_etapas_concluidas THEN
    -- Atualiza status da OP
    UPDATE ordens_producao
    SET status = 'concluida', updated_at = now()
    WHERE id = v_op_id AND status != 'concluida'
    RETURNING pedido_id INTO v_pedido_id;

    -- Registra evento
    IF v_pedido_id IS NOT NULL THEN
      INSERT INTO system_events (event_type, entity_type, entity_id, payload)
      VALUES ('production_completed', 'ordem_producao', v_op_id, jsonb_build_object(
        'pedido_id', v_pedido_id,
        'total_etapas', v_total_etapas,
        'completed_at', now()
      ));

      -- Atualiza pedido para "pronto_instalacao" se ainda está em produção
      UPDATE pedidos
      SET status = 'pronto_instalacao', updated_at = now()
      WHERE id = v_pedido_id AND status = 'em_producao';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Aplica trigger apenas se a tabela op_etapas existir
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'producao_etapas') THEN
    DROP TRIGGER IF EXISTS trg_check_production_completed ON producao_etapas;
    CREATE TRIGGER trg_check_production_completed
      AFTER UPDATE OF status ON producao_etapas
      FOR EACH ROW
      WHEN (NEW.status = 'concluido' AND OLD.status != 'concluido')
      EXECUTE FUNCTION fn_check_production_completed();
  END IF;
END;
$$;

-- ───────────────────────────────────────
-- TRIGGER 2: installation_completed
-- Dispara quando instalação é marcada como concluída
-- ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_installation_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    -- Registra evento
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('installation_completed', 'instalacao', NEW.id, jsonb_build_object(
      'pedido_id', NEW.pedido_id,
      'completed_at', now()
    ));

    -- Atualiza pedido para "instalado"
    UPDATE pedidos
    SET status = 'instalado', updated_at = now()
    WHERE id = NEW.pedido_id AND status IN ('pronto_instalacao', 'em_instalacao');
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ordens_instalacao') THEN
    DROP TRIGGER IF EXISTS trg_installation_completed ON ordens_instalacao;
    CREATE TRIGGER trg_installation_completed
      AFTER UPDATE OF status ON ordens_instalacao
      FOR EACH ROW
      EXECUTE FUNCTION fn_installation_completed();
  END IF;
END;
$$;

-- ───────────────────────────────────────
-- TRIGGER 3: payment_received
-- Dispara quando um pagamento é registrado
-- ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_payment_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' THEN
    -- Registra evento
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('payment_received', 'conta_receber', NEW.id, jsonb_build_object(
      'pedido_id', NEW.pedido_id,
      'valor', NEW.valor,
      'cliente_id', NEW.cliente_id,
      'paid_at', now()
    ));
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contas_receber') THEN
    DROP TRIGGER IF EXISTS trg_payment_received ON contas_receber;
    CREATE TRIGGER trg_payment_received
      AFTER UPDATE OF status ON contas_receber
      FOR EACH ROW
      EXECUTE FUNCTION fn_payment_received();
  END IF;
END;
$$;

-- ───────────────────────────────────────
-- TRIGGER 4: payment_overdue (via função scheduled)
-- Roda diariamente para detectar vencimentos
-- ───────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_detect_overdue_payments()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r RECORD;
BEGIN
  -- Busca contas vencidas que ainda não geraram evento hoje
  FOR r IN
    SELECT cr.id, cr.pedido_id, cr.valor, cr.cliente_id, cr.vencimento,
           (CURRENT_DATE - cr.vencimento::date) AS dias_atraso
    FROM contas_receber cr
    WHERE cr.status IN ('aberto', 'vencido')
      AND cr.vencimento < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM system_events se
        WHERE se.event_type = 'payment_overdue'
          AND se.entity_id = cr.id
          AND se.created_at::date = CURRENT_DATE
      )
  LOOP
    -- Atualiza status para vencido
    UPDATE contas_receber SET status = 'vencido', updated_at = now()
    WHERE id = r.id AND status = 'aberto';

    -- Registra evento
    INSERT INTO system_events (event_type, entity_type, entity_id, payload)
    VALUES ('payment_overdue', 'conta_receber', r.id, jsonb_build_object(
      'pedido_id', r.pedido_id,
      'valor', r.valor,
      'cliente_id', r.cliente_id,
      'vencimento', r.vencimento,
      'dias_atraso', r.dias_atraso
    ));
  END LOOP;
END;
$$;

-- ───────────────────────────────────────
-- PARTE 3: MEMORY LAYER (complemento ao migration 100)
-- Verifica se ai_memory já existe, caso contrário cria
-- ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  valor JSONB NOT NULL,
  confianca NUMERIC(3,2) DEFAULT 0.50,
  ocorrencias INT DEFAULT 1,
  primeira_vez TIMESTAMPTZ DEFAULT now(),
  ultima_vez TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tipo, chave)
);

ALTER TABLE ai_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_memory_service" ON ai_memory FOR ALL TO service_role USING (true);
CREATE POLICY "ai_memory_select" ON ai_memory FOR SELECT TO authenticated USING (true);

-- ═══════════════════════════════════════════════════
-- PARTE 4: Adicionar 'pronto_instalacao' e 'instalado'
-- ao VALID_TRANSITIONS se ainda não existirem
-- ═══════════════════════════════════════════════════

-- Verificar se a tabela/coluna de transições existe e atualizar
-- (Isso é aplicado no código React, não em tabela DB — apenas documentação)

-- Status válidos do pedido (referência):
-- rascunho → confirmado → em_producao → pronto_instalacao → em_instalacao → instalado → concluido → faturado
-- Qualquer status pode ir para → cancelado

COMMENT ON TABLE system_events IS 'Eventos do sistema para automação em cadeia — CROMA 4.0';
COMMENT ON TABLE ai_requests IS 'Requests da UI para processamento por Claude via MCP — CROMA 4.0';
COMMENT ON TABLE ai_responses IS 'Respostas do Claude para requests da UI — CROMA 4.0';
COMMENT ON TABLE ai_memory IS 'Memory Layer — padrões detectados pela IA para aprendizado — CROMA 4.0';
