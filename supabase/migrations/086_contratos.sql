-- ============================================================================
-- 086_contratos.sql — Contratos de manutenção recorrente (MRR)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contratos_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES clientes(id) NOT NULL,
  descricao text NOT NULL,
  valor_mensal numeric NOT NULL DEFAULT 0,
  periodicidade varchar(20) DEFAULT 'mensal' CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  data_inicio date NOT NULL,
  data_fim date,
  status varchar(20) DEFAULT 'ativo' CHECK (status IN ('ativo', 'suspenso', 'encerrado')),
  proximo_faturamento date,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  excluido_em timestamptz
);

CREATE INDEX IF NOT EXISTS contratos_servico_cliente_id_idx ON contratos_servico(cliente_id);
CREATE INDEX IF NOT EXISTS contratos_servico_status_idx ON contratos_servico(status) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS contratos_servico_proximo_faturamento_idx ON contratos_servico(proximo_faturamento) WHERE status = 'ativo';

-- RLS
ALTER TABLE contratos_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_servico_select" ON contratos_servico;
DROP POLICY IF EXISTS "contratos_servico_insert" ON contratos_servico;
DROP POLICY IF EXISTS "contratos_servico_update" ON contratos_servico;
DROP POLICY IF EXISTS "contratos_servico_delete" ON contratos_servico;

CREATE POLICY "contratos_servico_select" ON contratos_servico
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "contratos_servico_insert" ON contratos_servico
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "contratos_servico_update" ON contratos_servico
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "contratos_servico_delete" ON contratos_servico
  FOR DELETE USING (auth.role() = 'authenticated');
