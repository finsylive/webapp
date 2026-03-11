-- 010_user_type_overhaul.sql
-- Implements the "Explorer-Default + Additive Capabilities" model.
-- Adds primary_interest, investor_status, looking_for, linkedin to users.
-- Adds fundraising columns to startup_profiles.
-- Expands investor_profiles type CHECK and adds affiliated_fund.
-- Creates investor_deals and investor_deal_activity tables.

-- ─── 1. Users table: add 5 columns ─────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_interest text DEFAULT 'exploring',
  ADD COLUMN IF NOT EXISTS investor_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS investor_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS looking_for text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS linkedin text;

-- Add CHECK constraints separately (IF NOT EXISTS not supported for constraints on all PG versions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_primary_interest_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_primary_interest_check
      CHECK (primary_interest IN ('exploring', 'building', 'investing'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_investor_status_check'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_investor_status_check
      CHECK (investor_status IN ('none', 'applied', 'verified', 'rejected'));
  END IF;
END $$;

-- ─── 2. Expand user_type CHECK to allow 'explorer' ─────────────────────────

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check
  CHECK (user_type IN ('normal_user', 'mentor', 'founder', 'investor', 'explorer'));

-- ─── 3. Startup profiles: add fundraising columns ──────────────────────────

ALTER TABLE public.startup_profiles
  ADD COLUMN IF NOT EXISTS raise_target text,
  ADD COLUMN IF NOT EXISTS equity_offered text,
  ADD COLUMN IF NOT EXISTS min_ticket_size text,
  ADD COLUMN IF NOT EXISTS funding_stage text,
  ADD COLUMN IF NOT EXISTS sector text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'startup_profiles_funding_stage_check'
  ) THEN
    ALTER TABLE public.startup_profiles ADD CONSTRAINT startup_profiles_funding_stage_check
      CHECK (funding_stage IS NULL OR funding_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'bridge'));
  END IF;
END $$;

-- ─── 4. Investor profiles: expand type CHECK + add affiliated_fund ─────────

ALTER TABLE public.investor_profiles DROP CONSTRAINT IF EXISTS investor_profiles_investor_type_check;
ALTER TABLE public.investor_profiles ADD CONSTRAINT investor_profiles_investor_type_check
  CHECK (investor_type IS NULL OR investor_type IN (
    'angel', 'vc', 'family_office', 'accelerator', 'corporate_vc',
    'scout', 'syndicate_lead', 'government'
  ));

ALTER TABLE public.investor_profiles
  ADD COLUMN IF NOT EXISTS affiliated_fund text;

-- ─── 5. Create investor_deals table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investor_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL,
  startup_id uuid NOT NULL,
  stage text NOT NULL DEFAULT 'watching'
    CHECK (stage IN ('watching', 'interested', 'in_talks', 'due_diligence', 'invested', 'referred', 'passed')),
  notes text,
  invested_amount text,
  invested_date date,
  instrument text CHECK (instrument IS NULL OR instrument IN ('safe', 'equity', 'convertible_note', 'other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investor_deals_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deals_unique UNIQUE (investor_id, startup_id),
  CONSTRAINT investor_deals_investor_fkey FOREIGN KEY (investor_id) REFERENCES public.users(id),
  CONSTRAINT investor_deals_startup_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);

-- ─── 6. Create investor_deal_activity table ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.investor_deal_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  activity_type text NOT NULL
    CHECK (activity_type IN ('stage_change', 'note_added', 'meeting_scheduled', 'document_shared', 'message')),
  from_stage text,
  to_stage text,
  content text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT investor_deal_activity_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deal_activity_deal_fkey FOREIGN KEY (deal_id) REFERENCES public.investor_deals(id) ON DELETE CASCADE,
  CONSTRAINT investor_deal_activity_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);

-- ─── 7. RLS policies ──────────────────────────────────────────────────────

ALTER TABLE public.investor_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_deal_activity ENABLE ROW LEVEL SECURITY;

-- investor_deals: users manage their own deals
CREATE POLICY investor_deals_select ON public.investor_deals
  FOR SELECT USING (investor_id = auth.uid());

CREATE POLICY investor_deals_insert ON public.investor_deals
  FOR INSERT WITH CHECK (investor_id = auth.uid());

CREATE POLICY investor_deals_update ON public.investor_deals
  FOR UPDATE USING (investor_id = auth.uid());

CREATE POLICY investor_deals_delete ON public.investor_deals
  FOR DELETE USING (investor_id = auth.uid());

-- investor_deal_activity: read own deal activity, insert as self
CREATE POLICY investor_deal_activity_select ON public.investor_deal_activity
  FOR SELECT USING (
    deal_id IN (SELECT id FROM public.investor_deals WHERE investor_id = auth.uid())
  );

CREATE POLICY investor_deal_activity_insert ON public.investor_deal_activity
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ─── 8. Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_investor_deals_investor ON public.investor_deals(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_deals_startup ON public.investor_deals(startup_id);
CREATE INDEX IF NOT EXISTS idx_investor_deals_stage ON public.investor_deals(stage);
CREATE INDEX IF NOT EXISTS idx_investor_deal_activity_deal ON public.investor_deal_activity(deal_id);
CREATE INDEX IF NOT EXISTS idx_users_investor_status ON public.users(investor_status) WHERE investor_status != 'none';
CREATE INDEX IF NOT EXISTS idx_users_primary_interest ON public.users(primary_interest);
