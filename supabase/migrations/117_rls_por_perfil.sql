-- ============================================================================
-- MIGRATION 117: RLS (Row Level Security) por Perfil/Role
-- Restringe acesso aos dados baseado na role do usuário
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper Functions
-- ---------------------------------------------------------------------------

-- Get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles
  WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'comercial'); -- default to comercial if no role
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if user has access to a module
CREATE OR REPLACE FUNCTION user_has_module_access(module_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_modules TEXT[];
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  -- Admin has access to everything
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Map roles to accessible modules
  CASE v_role
    WHEN 'diretor' THEN
      v_modules := ARRAY['comercial', 'clientes', 'pedidos', 'producao', 'estoque',
                         'compras', 'financeiro', 'fiscal', 'instalacao', 'qualidade', 'dashboard'];
    WHEN 'comercial' THEN
      v_modules := ARRAY['comercial', 'clientes', 'pedidos', 'dashboard'];
    WHEN 'comercial_senior' THEN
      v_modules := ARRAY['comercial', 'clientes', 'pedidos', 'financeiro', 'dashboard', 'relatorios'];
    WHEN 'financeiro' THEN
      v_modules := ARRAY['financeiro', 'fiscal', 'clientes', 'pedidos', 'comercial', 'dashboard', 'relatorios'];
    WHEN 'producao' THEN
      v_modules := ARRAY['producao', 'estoque', 'pedidos', 'qualidade', 'dashboard'];
    WHEN 'compras' THEN
      v_modules := ARRAY['compras', 'estoque', 'financeiro', 'dashboard'];
    WHEN 'logistica' THEN
      v_modules := ARRAY['instalacao', 'pedidos', 'producao', 'dashboard'];
    WHEN 'instalador' THEN
      v_modules := ARRAY['instalacao', 'dashboard'];
    ELSE
      v_modules := ARRAY['dashboard']; -- restricted access
  END CASE;

  RETURN module_name = ANY(v_modules);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- RLS Policies: Financial Tables
-- ---------------------------------------------------------------------------

-- contas_receber: Only financeiro, admin, diretor can access
DROP POLICY IF EXISTS "contas_receber_access" ON contas_receber;
CREATE POLICY "contas_receber_access" ON contas_receber
  FOR ALL
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'financeiro'
  );

-- contas_pagar: Only financeiro, admin, diretor can access
DROP POLICY IF EXISTS "contas_pagar_access" ON contas_pagar;
CREATE POLICY "contas_pagar_access" ON contas_pagar
  FOR ALL
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'financeiro'
  );

-- ---------------------------------------------------------------------------
-- RLS Policies: Production Tables
-- ---------------------------------------------------------------------------

-- ordens_producao: Accessible to producao, compras, admin, diretor
DROP POLICY IF EXISTS "ordens_producao_access" ON ordens_producao;
CREATE POLICY "ordens_producao_access" ON ordens_producao
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'producao'
    OR get_user_role() = 'compras'
    OR get_user_role() = 'logistica'
  );

DROP POLICY IF EXISTS "ordens_producao_write" ON ordens_producao;
CREATE POLICY "ordens_producao_write" ON ordens_producao
  FOR INSERT, UPDATE, DELETE
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'producao'
  );

-- ---------------------------------------------------------------------------
-- RLS Policies: Profiles Table (self-read, admin-write)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read" ON profiles
  FOR SELECT
  USING (auth.uid() = id OR get_user_role() = 'admin' OR get_user_role() = 'diretor');

DROP POLICY IF EXISTS "profiles_self_update" ON profiles;
CREATE POLICY "profiles_self_update" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_manage" ON profiles;
CREATE POLICY "profiles_admin_manage" ON profiles
  FOR ALL
  USING (get_user_role() = 'admin');

-- ---------------------------------------------------------------------------
-- RLS Policies: Admin Tables (admin only)
-- ---------------------------------------------------------------------------

-- Enable RLS on admin-only tables if not already
DROP POLICY IF EXISTS "roles_view" ON roles;
CREATE POLICY "roles_view" ON roles
  FOR SELECT
  USING (get_user_role() = 'admin' OR get_user_role() = 'diretor');

DROP POLICY IF EXISTS "audit_logs_view" ON audit_logs;
CREATE POLICY "audit_logs_view" ON audit_logs
  FOR SELECT
  USING (get_user_role() = 'admin' OR get_user_role() = 'diretor');

-- ---------------------------------------------------------------------------
-- RLS Policies: Keep existing permissive policies for shared tables
-- ---------------------------------------------------------------------------

-- clientes: All authenticated users can read, but only comercial/compras/financeiro can write
DROP POLICY IF EXISTS "clientes_all_read" ON clientes;
CREATE POLICY "clientes_all_read" ON clientes
  FOR SELECT
  USING (TRUE); -- All authenticated users can read

DROP POLICY IF EXISTS "clientes_write" ON clientes;
CREATE POLICY "clientes_write" ON clientes
  FOR INSERT, UPDATE, DELETE
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'comercial'
    OR get_user_role() = 'comercial_senior'
    OR get_user_role() = 'financeiro'
  );

-- leads: All authenticated users can read, comercial can write
DROP POLICY IF EXISTS "leads_all_read" ON leads;
CREATE POLICY "leads_all_read" ON leads
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "leads_write" ON leads;
CREATE POLICY "leads_write" ON leads
  FOR INSERT, UPDATE, DELETE
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'comercial'
    OR get_user_role() = 'comercial_senior'
  );

-- pedidos: All relevant roles can read, restricted write
DROP POLICY IF EXISTS "pedidos_read" ON pedidos;
CREATE POLICY "pedidos_read" ON pedidos
  FOR SELECT
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR user_has_module_access('pedidos')
  );

DROP POLICY IF EXISTS "pedidos_write" ON pedidos;
CREATE POLICY "pedidos_write" ON pedidos
  FOR INSERT, UPDATE, DELETE
  USING (
    get_user_role() = 'admin'
    OR get_user_role() = 'diretor'
    OR get_user_role() = 'comercial_senior'
    OR get_user_role() = 'producao'
  );

-- ---------------------------------------------------------------------------
-- Disable RLS on non-sensitive tables (if needed)
-- ---------------------------------------------------------------------------

-- Keep RLS enabled on most tables for security
-- Explicitly allow "ativo = false" users to be denied at application level

COMMENT ON FUNCTION get_user_role() IS 'Returns the authenticated user role, defaulting to comercial for security';
COMMENT ON FUNCTION user_has_module_access(module_name TEXT) IS 'Checks if user has access to a specific module';
