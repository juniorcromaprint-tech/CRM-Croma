-- Migration: tabela campanha_destinatarios + campos de email em campanhas

-- Adicionar campos de email à tabela campanhas (se não existirem)
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS assunto_email TEXT;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS corpo_email TEXT;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_enviados INTEGER DEFAULT 0;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS total_abertos INTEGER DEFAULT 0;

-- Tabela de destinatários de campanha
CREATE TABLE IF NOT EXISTS campanha_destinatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES campanhas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES clientes(id),
  lead_id UUID REFERENCES leads(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'aberto', 'clicou', 'erro', 'bounce')),
  enviado_em TIMESTAMPTZ,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanha_dest_campanha ON campanha_destinatarios(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_dest_status ON campanha_destinatarios(status);

-- Trigger updated_at
CREATE TRIGGER set_updated_at_campanha_destinatarios
  BEFORE UPDATE ON campanha_destinatarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE campanha_destinatarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage campanha_destinatarios"
  ON campanha_destinatarios FOR ALL
  USING (auth.role() = 'authenticated');
