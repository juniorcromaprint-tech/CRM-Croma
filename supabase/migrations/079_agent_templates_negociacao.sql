-- ============================================================================
-- Migration 079: Add 'negociacao' to agent_templates etapa CHECK constraint
-- ============================================================================

ALTER TABLE agent_templates DROP CONSTRAINT IF EXISTS agent_templates_etapa_check;
ALTER TABLE agent_templates ADD CONSTRAINT agent_templates_etapa_check CHECK (etapa IN ('abertura', 'followup1', 'followup2', 'followup3', 'reengajamento', 'proposta', 'negociacao'));
