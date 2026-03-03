-- ============================================================
-- 011: Auto-create user profile row on auth signup
-- Also insert row for any existing auth users that are missing
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(
      LOWER(NEW.raw_user_meta_data->>'username'),
      LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ''))
    ),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: insert rows for any existing auth users missing from public.users
INSERT INTO public.users (id, email, full_name, username, avatar_url)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', ''),
  COALESCE(
    LOWER(au.raw_user_meta_data->>'username'),
    LOWER(REPLACE(SPLIT_PART(au.email, '@', 1), '.', ''))
  ),
  COALESCE(au.raw_user_meta_data->>'avatar_url', au.raw_user_meta_data->>'picture', '')
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
WHERE pu.id IS NULL;

-- 4. Add resume_url column (from migration 010)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS resume_url TEXT;
