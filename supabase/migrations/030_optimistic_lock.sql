-- Migration: optimistic locking via version column on transaction tables
-- Purpose: Prevent concurrent edit conflicts (two users editing same record simultaneously)

-- Add version column to critical transaction tables
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE propostas ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Function to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_pedidos_version ON pedidos;
CREATE TRIGGER trg_pedidos_version
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS trg_propostas_version ON propostas;
CREATE TRIGGER trg_propostas_version
  BEFORE UPDATE ON propostas
  FOR EACH ROW EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS trg_contas_receber_version ON contas_receber;
CREATE TRIGGER trg_contas_receber_version
  BEFORE UPDATE ON contas_receber
  FOR EACH ROW EXECUTE FUNCTION increment_version();

DROP TRIGGER IF EXISTS trg_contas_pagar_version ON contas_pagar;
CREATE TRIGGER trg_contas_pagar_version
  BEFORE UPDATE ON contas_pagar
  FOR EACH ROW EXECUTE FUNCTION increment_version();
