-- Migration 097: Add auto_aprovacao to agent_conversations
-- Enables the cron loop to auto-send messages for cold leads (score < 50)
-- without human approval.

ALTER TABLE agent_conversations
  ADD COLUMN IF NOT EXISTS auto_aprovacao BOOLEAN DEFAULT false;

COMMENT ON COLUMN agent_conversations.auto_aprovacao IS
  'When true, cron loop auto-approves and sends messages for leads with score < 50';

-- Index for cron loop query: active conversations needing follow-up
CREATE INDEX IF NOT EXISTS idx_agent_conversations_cron
  ON agent_conversations (status, proximo_followup)
  WHERE status = 'ativa' AND proximo_followup IS NOT NULL;
