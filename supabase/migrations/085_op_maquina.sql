-- 085_op_maquina.sql
-- Adiciona campos de agendamento de máquina na tabela ordens_producao
-- para permitir seleção de máquina e alocação de janela de produção

ALTER TABLE ordens_producao
  ADD COLUMN IF NOT EXISTS maquina_id uuid REFERENCES maquinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_inicio_prevista timestamptz,
  ADD COLUMN IF NOT EXISTS data_fim_prevista timestamptz;

CREATE INDEX IF NOT EXISTS idx_op_maquina_id ON ordens_producao(maquina_id)
  WHERE maquina_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_op_inicio_previsto ON ordens_producao(data_inicio_prevista)
  WHERE data_inicio_prevista IS NOT NULL;

COMMENT ON COLUMN ordens_producao.maquina_id IS 'Máquina principal alocada para esta OP (opcional)';
COMMENT ON COLUMN ordens_producao.data_inicio_prevista IS 'Início previsto da execução na máquina';
COMMENT ON COLUMN ordens_producao.data_fim_prevista IS 'Fim previsto da execução na máquina';
