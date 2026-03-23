-- ============================================================================
-- Migration 094: Sprint 9 — Blindagem Critica
-- ============================================================================
-- Fixes CRITICAL security and workflow issues:
--   1. pedidos.status CHECK constraint missing 'faturado'/'entregue'
--   2. admin_config RLS — API keys exposed to all authenticated users
--   3. profiles.role self-escalation prevention
--   4. comissoes RLS — unrestricted access to commission data
--   5. cliente_contatos RLS — 296 rows of PII unprotected
-- ============================================================================

-- ============================================================================
-- 1. FIX pedidos.status CHECK constraint (CRITICAL)
--    The billing workflow is blocked because 'faturado' and 'entregue'
--    are not in the allowed values.
-- ============================================================================
DO $$
BEGIN
  ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;

  ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
    CHECK (status IN (
      'rascunho',
      'aguardando_aprovacao',
      'aprovado',
      'em_producao',
      'produzido',
      'aguardando_instalacao',
      'em_instalacao',
      'parcialmente_concluido',
      'concluido',
      'faturado',
      'entregue',
      'cancelado'
    ));

  RAISE NOTICE '[094] pedidos.status CHECK constraint updated with faturado/entregue';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[094] pedidos.status CHECK — skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- 2. SECURE admin_config (CRITICAL)
--    Any authenticated user can currently read API keys stored here.
--    Restrict to admin role only.
-- ============================================================================
DO $$
BEGIN
  ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

  -- Drop all known permissive policies
  DROP POLICY IF EXISTS "Authenticated users can manage admin_config" ON admin_config;
  DROP POLICY IF EXISTS "admin_config_select" ON admin_config;
  DROP POLICY IF EXISTS "admin_config_all" ON admin_config;
  DROP POLICY IF EXISTS "admin_config_admin_only" ON admin_config;

  -- Only admins can read/write
  CREATE POLICY "admin_config_admin_only" ON admin_config
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

  RAISE NOTICE '[094] admin_config RLS locked to admin-only';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[094] admin_config RLS — skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- 3. PROTECT profiles.role from self-escalation (HIGH)
--    Users must not be able to change their own role to 'admin'.
--    Admins can change any profile including roles.
-- ============================================================================
DO $$
BEGIN
  -- Drop all known permissive policies on profiles
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON profiles;
  DROP POLICY IF EXISTS "profiles_select" ON profiles;
  DROP POLICY IF EXISTS "profiles_update" ON profiles;
  DROP POLICY IF EXISTS "profiles_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_admin_update_any" ON profiles;
  DROP POLICY IF EXISTS "profiles_admin_insert" ON profiles;

  -- Everyone can read all profiles (needed for team views, assignment dropdowns)
  CREATE POLICY "profiles_select_all" ON profiles
    FOR SELECT TO authenticated
    USING (true);

  -- Users can update their OWN profile, but role must stay the same
  -- (unless they are an admin, who can change anything)
  CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
      id = auth.uid() AND (
        role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
        OR EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'admin')
      )
    );

  -- Admins can update any profile (including role changes for other users)
  CREATE POLICY "profiles_admin_update_any" ON profiles
    FOR UPDATE TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

  -- Only admins can insert new profiles
  CREATE POLICY "profiles_admin_insert" ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );

  RAISE NOTICE '[094] profiles RLS hardened — role self-escalation blocked';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[094] profiles RLS — skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- 4. ADD RLS to comissoes table (HIGH)
--    Commission data should only be visible to financeiro/admin/diretor,
--    and vendors should see only their own records.
-- ============================================================================
DO $$
BEGIN
  ALTER TABLE comissoes ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "comissoes_select" ON comissoes;
  DROP POLICY IF EXISTS "comissoes_all" ON comissoes;
  DROP POLICY IF EXISTS "comissoes_admin_financeiro" ON comissoes;
  DROP POLICY IF EXISTS "comissoes_vendor_read" ON comissoes;

  -- Financeiro, admin and diretor can manage all commissions
  CREATE POLICY "comissoes_admin_financeiro" ON comissoes
    FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'financeiro', 'diretor'))
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'financeiro', 'diretor'))
    );

  -- Vendors can see their own commissions (read-only)
  CREATE POLICY "comissoes_vendor_read" ON comissoes
    FOR SELECT TO authenticated
    USING (
      vendedor_id = auth.uid()
    );

  RAISE NOTICE '[094] comissoes RLS enabled — role-based access';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[094] comissoes RLS — skipped: %', SQLERRM;
END $$;

-- ============================================================================
-- 5. ADD RLS to cliente_contatos (HIGH)
--    296 rows of PII (phone, email, contact names) currently unprotected.
--    All authenticated users need access (used across CRM workflows).
-- ============================================================================
DO $$
BEGIN
  ALTER TABLE cliente_contatos ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "cliente_contatos_authenticated" ON cliente_contatos;

  CREATE POLICY "cliente_contatos_authenticated" ON cliente_contatos
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

  RAISE NOTICE '[094] cliente_contatos RLS enabled';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[094] cliente_contatos RLS — skipped: %', SQLERRM;
END $$;
