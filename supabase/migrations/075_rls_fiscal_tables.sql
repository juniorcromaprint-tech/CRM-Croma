-- supabase/migrations/075_rls_fiscal_tables.sql
-- Fix: 11 tabelas fiscais sem RLS

-- Habilitar RLS em todas
ALTER TABLE fiscal_ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_regras_operacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documentos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_xmls ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_filas_emissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_erros_transmissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_audit_logs ENABLE ROW LEVEL SECURITY;

-- fiscal_ambientes
CREATE POLICY "fiscal_ambientes_select" ON fiscal_ambientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_ambientes_modify" ON fiscal_ambientes FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_role('diretor') OR is_admin());

-- fiscal_series
CREATE POLICY "fiscal_series_select" ON fiscal_series FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_series_modify" ON fiscal_series FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_certificados (sensível — só admin)
CREATE POLICY "fiscal_certificados_select" ON fiscal_certificados FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_admin());
CREATE POLICY "fiscal_certificados_modify" ON fiscal_certificados FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- fiscal_regras_operacao
CREATE POLICY "fiscal_regras_select" ON fiscal_regras_operacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_regras_modify" ON fiscal_regras_operacao FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_documentos
CREATE POLICY "fiscal_docs_select" ON fiscal_documentos FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_role('comercial_senior') OR is_admin());
CREATE POLICY "fiscal_docs_modify" ON fiscal_documentos FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_documentos_itens
CREATE POLICY "fiscal_itens_select" ON fiscal_documentos_itens FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_role('comercial_senior') OR is_admin());
CREATE POLICY "fiscal_itens_modify" ON fiscal_documentos_itens FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_eventos (logs — todos leem, só financeiro/admin escrevem)
CREATE POLICY "fiscal_eventos_select" ON fiscal_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_eventos_modify" ON fiscal_eventos FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_xmls
CREATE POLICY "fiscal_xmls_select" ON fiscal_xmls FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_admin());
CREATE POLICY "fiscal_xmls_modify" ON fiscal_xmls FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_filas_emissao
CREATE POLICY "fiscal_fila_select" ON fiscal_filas_emissao FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_admin());
CREATE POLICY "fiscal_fila_modify" ON fiscal_filas_emissao FOR ALL TO authenticated
  USING (is_role('financeiro') OR is_admin())
  WITH CHECK (is_role('financeiro') OR is_admin());

-- fiscal_erros_transmissao
CREATE POLICY "fiscal_erros_select" ON fiscal_erros_transmissao FOR SELECT TO authenticated USING (true);
CREATE POLICY "fiscal_erros_insert" ON fiscal_erros_transmissao FOR INSERT TO authenticated WITH CHECK (true);

-- fiscal_audit_logs (append-only — todos inserem, só admin/financeiro leem)
CREATE POLICY "fiscal_audit_select" ON fiscal_audit_logs FOR SELECT TO authenticated
  USING (is_role('financeiro') OR is_role('diretor') OR is_admin());
CREATE POLICY "fiscal_audit_insert" ON fiscal_audit_logs FOR INSERT TO authenticated WITH CHECK (true);
