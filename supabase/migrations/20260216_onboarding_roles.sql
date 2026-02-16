-- ============================================================
-- Migration: Investor & Founder Onboarding + Role System
-- Date: 2026-02-16
-- ============================================================

-- 1. Add onboarding_step column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

-- 2. Update user_type check constraint to support new roles
-- Drop old constraint and add a new one with founder/investor (keeping mentor)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check
  CHECK (user_type = ANY (ARRAY['mentor'::text, 'normal_user'::text, 'founder'::text, 'investor'::text]));

-- 3. Create founder_profiles table
CREATE TABLE IF NOT EXISTS public.founder_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  company_name TEXT,
  industry TEXT,
  stage TEXT CHECK (stage IN ('idea', 'pre_seed', 'seed', 'series_a', 'series_b_plus', 'profitable')),
  team_size TEXT CHECK (team_size IN ('solo', '2_5', '6_20', '21_50', '50_plus')),
  pitch TEXT,
  looking_for TEXT[] DEFAULT '{}',
  website TEXT,
  linkedin TEXT,
  location TEXT,
  is_actively_raising BOOLEAN DEFAULT false,
  raise_amount TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create investor_profiles table
CREATE TABLE IF NOT EXISTS public.investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  firm_name TEXT,
  investor_type TEXT CHECK (investor_type IN ('angel', 'vc', 'family_office', 'accelerator', 'corporate_vc')),
  check_size_min TEXT,
  check_size_max TEXT,
  preferred_stages TEXT[] DEFAULT '{}',
  preferred_sectors TEXT[] DEFAULT '{}',
  portfolio_count INTEGER DEFAULT 0,
  thesis TEXT,
  linkedin TEXT,
  website TEXT,
  location TEXT,
  is_actively_investing BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS founder_profiles_updated_at ON public.founder_profiles;
CREATE TRIGGER founder_profiles_updated_at
  BEFORE UPDATE ON public.founder_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS investor_profiles_updated_at ON public.investor_profiles;
CREATE TRIGGER investor_profiles_updated_at
  BEFORE UPDATE ON public.investor_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. RLS Policies

ALTER TABLE public.founder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_profiles ENABLE ROW LEVEL SECURITY;

-- Founder profiles: owner can CRUD, everyone can read
CREATE POLICY "founder_profiles_select" ON public.founder_profiles
  FOR SELECT USING (true);

CREATE POLICY "founder_profiles_insert" ON public.founder_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "founder_profiles_update" ON public.founder_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "founder_profiles_delete" ON public.founder_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- Investor profiles: owner can CRUD, everyone can read
CREATE POLICY "investor_profiles_select" ON public.investor_profiles
  FOR SELECT USING (true);

CREATE POLICY "investor_profiles_insert" ON public.investor_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "investor_profiles_update" ON public.investor_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "investor_profiles_delete" ON public.investor_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_founder_profiles_user_id ON public.founder_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_founder_profiles_stage ON public.founder_profiles(stage);
CREATE INDEX IF NOT EXISTS idx_founder_profiles_industry ON public.founder_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_founder_profiles_raising ON public.founder_profiles(is_actively_raising) WHERE is_actively_raising = true;

CREATE INDEX IF NOT EXISTS idx_investor_profiles_user_id ON public.investor_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_type ON public.investor_profiles(investor_type);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_investing ON public.investor_profiles(is_actively_investing) WHERE is_actively_investing = true;

CREATE INDEX IF NOT EXISTS idx_users_user_type ON public.users(user_type);
CREATE INDEX IF NOT EXISTS idx_users_onboarding ON public.users(is_onboarding_done) WHERE is_onboarding_done = false;
