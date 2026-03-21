-- ============================================================================
-- 087_aprovacao_contas.sql — Approval workflow para contas a pagar
-- ============================================================================

ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS aprovado_por uuid REFERENCES auth.users(id);
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS requer_aprovacao boolean DEFAULT false;
ALTER TABLE contas_pagar ADD COLUMN IF NOT EXISTS motivo_rejeicao text;

-- Adicionar 'pendente_aprovacao' ao status existente via constraint drop + recreate
-- (caso a tabela use CHECK constraint no status, precisamos atualizar)
-- Verificar se existe constraint de status e atualizar se necessário:
DO $$
BEGIN
  -- Drop old check constraint if it exists (pode ter nome variado)
  ALTER TABLE contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_status_check;
  ALTER TABLE contas_pagar DROP CONSTRAINT IF EXISTS contas_pagar_status_check1;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE contas_pagar
  ADD CONSTRAINT contas_pagar_status_check
  CHECK (status IN ('a_pagar', 'vencido', 'parcial', 'pago', 'cancelado', 'pendente_aprovacao', 'rejeitado'));

-- Index para buscar aprovações pendentes rapidamente
CREATE INDEX IF NOT EXISTS contas_pagar_pendente_aprovacao_idx
  ON contas_pagar(status)
  WHERE status = 'pendente_aprovacao' AND excluido_em IS NULL;
