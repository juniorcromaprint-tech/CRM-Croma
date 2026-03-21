-- ============================================================================
-- 089 — Webhooks configuráveis
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(100) NOT NULL,
  url text NOT NULL,
  eventos text[] DEFAULT '{}',  -- ex: ['pedido.criado', 'proposta.aprovada']
  ativo boolean DEFAULT true,
  secret varchar(64),
  created_at timestamptz DEFAULT now()
);

-- RLS: apenas autenticados (admin) gerenciam webhooks
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_configs_auth_all"
  ON webhook_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índice rápido por status ativo
CREATE INDEX IF NOT EXISTS idx_webhook_configs_ativo
  ON webhook_configs (ativo);
