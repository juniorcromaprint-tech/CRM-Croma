-- 050_rls_helpers.sql
-- Funções helper para RLS — reutilizadas em todos os sprints

-- Helper: retorna o role do usuário autenticado
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    'comercial'
  );
$$;

-- Helper: verifica se é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT get_user_role() = 'admin';
$$;

-- Helper: verifica role específico (admin tem acesso a tudo)
CREATE OR REPLACE FUNCTION is_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT get_user_role() = role_name OR get_user_role() = 'admin';
$$;

-- Helper: drop all policies em uma tabela (para reset limpo antes de reaplicar)
CREATE OR REPLACE FUNCTION drop_all_policies(target_table TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname FROM pg_policies
    WHERE tablename = target_table AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, target_table);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION is_role(TEXT) TO authenticated;
