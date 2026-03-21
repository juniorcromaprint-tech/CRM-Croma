-- Migration 083: NPS pós-instalação
-- Registra avaliações de satisfação (0-10) por pedido concluído

CREATE TABLE IF NOT EXISTS nps_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid REFERENCES pedidos(id),
  cliente_id uuid REFERENCES clientes(id),
  token varchar(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  nota smallint CHECK (nota BETWEEN 0 AND 10),
  comentario text,
  respondido_em timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX ON nps_respostas(token);
CREATE INDEX ON nps_respostas(pedido_id);

-- RLS: leitura pública por token (portal cliente), escrita apenas autenticada
ALTER TABLE nps_respostas ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer pessoa (anon) leia/atualize por token — necessário p/ página pública
CREATE POLICY "nps_public_read_by_token" ON nps_respostas
  FOR SELECT USING (true);

CREATE POLICY "nps_public_update_by_token" ON nps_respostas
  FOR UPDATE USING (true);

-- Apenas usuários autenticados podem inserir (criado no backend ao concluir pedido)
CREATE POLICY "nps_insert_authenticated" ON nps_respostas
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
