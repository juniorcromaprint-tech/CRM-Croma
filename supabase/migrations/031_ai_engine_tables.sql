-- 031_ai_engine_tables.sql
-- Croma AI Engine: tables for logging and operational alerts

-- 1. AI usage logs (audit + cost tracking)
CREATE TABLE ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  function_name text NOT NULL,
  entity_type text,
  entity_id uuid,
  model_used text NOT NULL,
  tokens_input int NOT NULL DEFAULT 0,
  tokens_output int NOT NULL DEFAULT 0,
  cost_usd numeric(10,6) DEFAULT 0,
  duration_ms int,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_logs_user ON ai_logs(user_id, created_at DESC);
CREATE INDEX idx_ai_logs_entity ON ai_logs(entity_type, entity_id);

-- 2. Operational alerts (cron + manual detection)
CREATE TABLE ai_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidade text NOT NULL DEFAULT 'media',
  titulo text NOT NULL,
  descricao text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  resolvido boolean DEFAULT false,
  resolvido_por uuid REFERENCES auth.users(id),
  resolvido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_alertas_active ON ai_alertas(resolvido, severidade) WHERE NOT resolvido;
CREATE INDEX idx_ai_alertas_entity ON ai_alertas(entity_type, entity_id);

-- 3. RLS
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_own_logs" ON ai_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_role_insert_logs" ON ai_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "authenticated_read_alertas" ON ai_alertas
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_resolve_alertas" ON ai_alertas
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "service_role_manage_alertas" ON ai_alertas
  FOR ALL USING (true);
