-- ============================================================================
-- MIGRATION 118: Auth Trigger for Profile Creation
-- Automatically creates profile when new user is created in Supabase Auth
-- New self-registered users get ativo=false and role=null (pending approval)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Function to handle new user creation via Supabase Auth
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    ativo
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NULL, -- No role assigned (pending approval)
    FALSE -- Inactive by default (admin must approve)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Function to handle user deletion (cascade delete)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for cascade delete
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

COMMENT ON FUNCTION public.handle_new_user() IS 'Automatically creates a profile for new auth users with ativo=false and role=null (requires admin approval)';
COMMENT ON FUNCTION public.handle_auth_user_deleted() IS 'Cascades delete to profile when auth user is deleted';
