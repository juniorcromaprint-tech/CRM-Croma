-- 033_import_logs.sql
-- Tabela de auditoria para operações de importação/exportação/edição em massa

CREATE TABLE import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('import', 'export', 'bulk_edit')),
  filename TEXT,
  total_rows INT DEFAULT 0,
  inserted INT DEFAULT 0,
  updated INT DEFAULT 0,
  skipped INT DEFAULT 0,
  errors INT DEFAULT 0,
  error_details JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_import_logs_entity ON import_logs(entity);
CREATE INDEX idx_import_logs_user ON import_logs(user_id);
CREATE INDEX idx_import_logs_created ON import_logs(created_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view logs"
  ON import_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert own logs"
  ON import_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);
