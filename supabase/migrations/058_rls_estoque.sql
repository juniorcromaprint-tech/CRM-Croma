-- Migration 058: RLS para módulo de estoque (6 tabelas)
-- Usa helpers da migration 050 (get_user_role, drop_all_policies)

-- Limpar policies existentes
DO $$ BEGIN
  PERFORM drop_all_policies('estoque_saldos');
  PERFORM drop_all_policies('estoque_movimentacoes');
  PERFORM drop_all_policies('fornecedores');
  PERFORM drop_all_policies('inventarios');
  PERFORM drop_all_policies('inventario_itens');
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'drop_all_policies não encontrada, continuando...';
END $$;

-- Limpar manualmente para estoque_reservas (nova tabela)
DROP POLICY IF EXISTS "reservas_select" ON estoque_reservas;
DROP POLICY IF EXISTS "reservas_write" ON estoque_reservas;

-- estoque_saldos: todos autenticados leem, almoxarife/admin/producao editam
ALTER TABLE estoque_saldos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_saldos_select" ON estoque_saldos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque_saldos_write" ON estoque_saldos
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'almoxarife', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife', 'producao'));

-- estoque_movimentacoes: todos leem, almoxarife/admin/producao inserem (sem update/delete)
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estoque_mov_select" ON estoque_movimentacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "estoque_mov_insert" ON estoque_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife', 'producao'));

-- estoque_reservas: todos leem, producao/almoxarife/admin escrevem
ALTER TABLE estoque_reservas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservas_select" ON estoque_reservas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reservas_write" ON estoque_reservas
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'almoxarife', 'producao'))
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife', 'producao'));

-- fornecedores: todos leem, admin/almoxarife editam
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores_select" ON fornecedores
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fornecedores_write" ON fornecedores
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'almoxarife'))
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife'));

-- inventarios
ALTER TABLE inventarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventarios_select" ON inventarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inventarios_write" ON inventarios
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'almoxarife'))
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife'));

-- inventario_itens
ALTER TABLE inventario_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_itens_select" ON inventario_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "inv_itens_write" ON inventario_itens
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'almoxarife'))
  WITH CHECK (get_user_role() IN ('admin', 'almoxarife'));
