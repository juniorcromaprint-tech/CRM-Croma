-- supabase/migrations/072_fix_contabil_rls_policies.sql
-- Fix: policies contábeis referenciam user_profiles (inexistente), deve ser profiles

-- lancamentos_contabeis
DROP POLICY IF EXISTS "lancamentos_contabeis_insert" ON lancamentos_contabeis;
DROP POLICY IF EXISTS "lancamentos_contabeis_update" ON lancamentos_contabeis;
DROP POLICY IF EXISTS "lancamentos_insert_financeiro" ON lancamentos_contabeis;
DROP POLICY IF EXISTS "lancamentos_update_financeiro" ON lancamentos_contabeis;

CREATE POLICY "lancamentos_contabeis_insert" ON lancamentos_contabeis
  FOR INSERT TO authenticated
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

CREATE POLICY "lancamentos_contabeis_update" ON lancamentos_contabeis
  FOR UPDATE TO authenticated
  USING (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

-- das_apuracoes
DROP POLICY IF EXISTS "das_apuracoes_manage" ON das_apuracoes;
DROP POLICY IF EXISTS "das_write_financeiro" ON das_apuracoes;

CREATE POLICY "das_apuracoes_manage" ON das_apuracoes
  FOR ALL TO authenticated
  USING (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

-- extrato_bancario_importacoes
DROP POLICY IF EXISTS "extrato_importacoes_manage" ON extrato_bancario_importacoes;
DROP POLICY IF EXISTS "extrato_imp_write" ON extrato_bancario_importacoes;

CREATE POLICY "extrato_importacoes_manage" ON extrato_bancario_importacoes
  FOR ALL TO authenticated
  USING (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

-- extrato_bancario_itens
DROP POLICY IF EXISTS "extrato_itens_manage" ON extrato_bancario_itens;
DROP POLICY IF EXISTS "extrato_itens_write" ON extrato_bancario_itens;

CREATE POLICY "extrato_itens_manage" ON extrato_bancario_itens
  FOR ALL TO authenticated
  USING (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

-- extrato_regras_classificacao
DROP POLICY IF EXISTS "extrato_regras_manage" ON extrato_regras_classificacao;
DROP POLICY IF EXISTS "regras_class_write" ON extrato_regras_classificacao;

CREATE POLICY "extrato_regras_manage" ON extrato_regras_classificacao
  FOR ALL TO authenticated
  USING (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('financeiro') OR is_role('diretor') OR is_admin()
  );

-- config_tributaria
DROP POLICY IF EXISTS "config_tributaria_manage" ON config_tributaria;
DROP POLICY IF EXISTS "config_trib_write" ON config_tributaria;

CREATE POLICY "config_tributaria_manage" ON config_tributaria
  FOR ALL TO authenticated
  USING (
    is_role('diretor') OR is_admin()
  )
  WITH CHECK (
    is_role('diretor') OR is_admin()
  );
