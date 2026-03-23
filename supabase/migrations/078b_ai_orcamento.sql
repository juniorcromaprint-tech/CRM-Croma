-- 078_ai_orcamento.sql
-- Colunas para vincular propostas geradas pela IA ao agente

ALTER TABLE propostas ADD COLUMN IF NOT EXISTS gerado_por_ia BOOLEAN DEFAULT false;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES agent_conversations(id);

CREATE INDEX IF NOT EXISTS idx_propostas_conversation_id
  ON propostas(conversation_id) WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN propostas.gerado_por_ia IS 'Proposta gerada automaticamente pelo agente IA';
COMMENT ON COLUMN propostas.conversation_id IS 'Conversa do agente que originou esta proposta';
