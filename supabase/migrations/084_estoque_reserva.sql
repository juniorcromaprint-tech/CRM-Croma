-- ============================================================================
-- Migration 084 — Reserva de Estoque por Ordem de Produção
-- ============================================================================

-- Tabela de reservas de estoque por OP
CREATE TABLE IF NOT EXISTS estoque_reservas_op (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id uuid NOT NULL,
  material_id uuid REFERENCES materiais(id),
  quantidade_reservada numeric NOT NULL,
  reservado_em timestamptz DEFAULT now(),
  liberado_em timestamptz,
  CONSTRAINT reserva_positiva CHECK (quantidade_reservada > 0)
);

CREATE INDEX IF NOT EXISTS idx_estoque_reservas_op_op_id
  ON estoque_reservas_op(ordem_producao_id);

CREATE INDEX IF NOT EXISTS idx_estoque_reservas_op_material_ativo
  ON estoque_reservas_op(material_id) WHERE liberado_em IS NULL;

-- RLS
ALTER TABLE estoque_reservas_op ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estoque_reservas_op_select" ON estoque_reservas_op
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "estoque_reservas_op_insert" ON estoque_reservas_op
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "estoque_reservas_op_update" ON estoque_reservas_op
  FOR UPDATE USING (auth.role() = 'authenticated');

-- View auxiliar: estoque disponível = estoque_atual − reservas ativas
CREATE OR REPLACE VIEW vw_estoque_disponivel AS
SELECT
  m.id AS material_id,
  m.nome,
  m.unidade,
  m.estoque_atual,
  m.estoque_minimo,
  COALESCE(SUM(r.quantidade_reservada) FILTER (WHERE r.liberado_em IS NULL), 0) AS reservado,
  m.estoque_atual - COALESCE(SUM(r.quantidade_reservada) FILTER (WHERE r.liberado_em IS NULL), 0) AS disponivel
FROM materiais m
LEFT JOIN estoque_reservas_op r ON r.material_id = m.id
GROUP BY m.id, m.nome, m.unidade, m.estoque_atual, m.estoque_minimo;
