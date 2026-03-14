-- Migration 028: tabela retornos_bancarios para histórico de importação CNAB 400 retorno

CREATE TABLE IF NOT EXISTS retornos_bancarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  banco TEXT NOT NULL,
  data_arquivo TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_registros INTEGER NOT NULL DEFAULT 0,
  total_liquidacoes INTEGER NOT NULL DEFAULT 0,
  total_nao_encontrados INTEGER NOT NULL DEFAULT 0,
  total_erros INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at (usa função já existente do migration 002)
CREATE TRIGGER set_updated_at_retornos_bancarios
  BEFORE UPDATE ON retornos_bancarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Campos de pagamento no bank_slips (se não existirem)
ALTER TABLE bank_slips ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE bank_slips ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2);

-- RLS
ALTER TABLE retornos_bancarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage retornos"
  ON retornos_bancarios FOR ALL
  USING (auth.role() = 'authenticated');
