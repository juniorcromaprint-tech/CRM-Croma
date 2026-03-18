-- supabase/migrations/071_fix_get_user_role.sql
-- Fix: get_user_role() deve ler de profiles.role, não de JWT user_metadata
-- A migration 050 quebrou isso ao mudar para auth.jwt()
-- A migration 005 tinha a implementação correta

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'comercial'
  );
$$;

-- Recriar is_admin() para garantir consistência
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT get_user_role() = 'admin';
$$;

-- Recriar is_role() para garantir consistência
CREATE OR REPLACE FUNCTION is_role(role_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT get_user_role() = role_name OR get_user_role() = 'admin';
$$;
