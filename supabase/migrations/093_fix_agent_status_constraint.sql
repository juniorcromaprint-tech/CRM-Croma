-- Migration 093: Fix agent_conversations status CHECK constraint
-- Adiciona 'escalada' ao constraint que estava faltando na migration 077

ALTER TABLE agent_conversations
  DROP CONSTRAINT IF EXISTS agent_conversations_status_check;

ALTER TABLE agent_conversations
  ADD CONSTRAINT agent_conversations_status_check
  CHECK (status IN ('ativa', 'pausada', 'aguardando_aprovacao', 'convertida', 'encerrada', 'escalada'));
