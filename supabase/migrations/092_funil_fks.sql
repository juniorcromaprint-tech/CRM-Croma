-- Migration 092 — FKs de rastreabilidade do funil comercial
-- propostas.lead_id → leads para rastrear origem
-- pedidos.proposta_id → propostas para rastrear conversão

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS proposta_id uuid REFERENCES propostas(id);

CREATE INDEX IF NOT EXISTS idx_propostas_lead_id ON propostas(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_proposta_id ON pedidos(proposta_id) WHERE proposta_id IS NOT NULL;

COMMENT ON COLUMN propostas.lead_id IS 'Lead de origem desta proposta (rastreabilidade do funil)';
COMMENT ON COLUMN pedidos.proposta_id IS 'Proposta de origem deste pedido (rastreabilidade do funil)';
