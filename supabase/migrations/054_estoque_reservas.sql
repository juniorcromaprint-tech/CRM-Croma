-- Migration 054: tabela estoque_reservas (reserva por OS com liberação automática)

CREATE TABLE IF NOT EXISTS estoque_reservas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
  ordem_producao_id UUID REFERENCES ordens_producao(id) ON DELETE CASCADE,
  quantidade NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'liberada', 'consumida')),
  liberada_em TIMESTAMPTZ,
  consumida_em TIMESTAMPTZ,
  usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservas_material ON estoque_reservas(material_id);
CREATE INDEX IF NOT EXISTS idx_reservas_op ON estoque_reservas(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON estoque_reservas(status);

COMMENT ON TABLE estoque_reservas IS 'Reservas de material por Ordem de Produção';
