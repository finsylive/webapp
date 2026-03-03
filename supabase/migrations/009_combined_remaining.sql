-- ============================================================
-- COMBINED REMAINING MIGRATIONS (003, 004, 006, 007, 008)
-- Run this AFTER 000_base_schema.sql
-- ============================================================

-- === 003: Startup onboarding columns ========================

ALTER TABLE public.startup_profiles
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS key_strengths text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS revenue_amount text,
  ADD COLUMN IF NOT EXISTS revenue_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS revenue_growth text,
  ADD COLUMN IF NOT EXISTS traction_metrics text,
  ADD COLUMN IF NOT EXISTS total_raised text,
  ADD COLUMN IF NOT EXISTS investor_count integer,
  ADD COLUMN IF NOT EXISTS elevator_pitch text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text;

-- === 004: Founder ments profile (drop linkedin, add user_id etc) =

ALTER TABLE public.startup_founders
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ments_username text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'accepted'
    CHECK (status IN ('pending', 'accepted', 'declined'));

ALTER TABLE public.startup_founders
  DROP COLUMN IF EXISTS linkedin_url;

CREATE INDEX IF NOT EXISTS idx_startup_founders_user_id ON public.startup_founders(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_startup_founders_pending ON public.startup_founders(user_id, status) WHERE status = 'pending';

-- === 004: Poll vote constraints ==============================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_vote_user_option'
  ) THEN
    ALTER TABLE post_poll_votes
      ADD CONSTRAINT uq_vote_user_option UNIQUE (user_id, poll_option_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_single_choice_vote()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
DECLARE
  v_poll_id   UUID;
  v_poll_type TEXT;
BEGIN
  SELECT ppo.poll_id, pp.poll_type
  INTO v_poll_id, v_poll_type
  FROM post_poll_options ppo
  JOIN post_polls pp ON pp.id = ppo.poll_id
  WHERE ppo.id = NEW.poll_option_id;

  IF v_poll_type = 'single_choice' THEN
    DELETE FROM post_poll_votes
    WHERE user_id = NEW.user_id
      AND poll_option_id IN (
        SELECT id FROM post_poll_options WHERE poll_id = v_poll_id
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_choice ON post_poll_votes;

CREATE TRIGGER trg_enforce_single_choice
  BEFORE INSERT ON post_poll_votes
  FOR EACH ROW EXECUTE FUNCTION enforce_single_choice_vote();

-- === 006: Founder email ======================================

ALTER TABLE public.startup_founders
  ADD COLUMN IF NOT EXISTS email text;

-- === 007: Founder avatar and role ============================

ALTER TABLE public.startup_founders
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS role text;

-- === 008: Events & Competitions Maturity =====================

-- Competitions new columns
ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS tags               text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domain             text,
  ADD COLUMN IF NOT EXISTS organizer_name     text,
  ADD COLUMN IF NOT EXISTS participation_type text    NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS team_size_min      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS team_size_max      integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS eligibility_criteria text;

ALTER TABLE competitions
  DROP CONSTRAINT IF EXISTS competitions_participation_type_check;

ALTER TABLE competitions
  ADD CONSTRAINT competitions_participation_type_check
    CHECK (participation_type IN ('individual', 'team'));

-- Events new columns
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS tags           text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS organizer_name text;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_category_check;

ALTER TABLE events
  ADD CONSTRAINT events_category_check
    CHECK (category IN ('event', 'meetup', 'workshop', 'conference', 'seminar'));

UPDATE events SET category = 'event' WHERE category IS NULL OR category = '';

-- Competition Rounds
CREATE TABLE IF NOT EXISTS competition_rounds (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid        NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  round_number   integer     NOT NULL DEFAULT 1,
  title          text        NOT NULL,
  description    text,
  start_date     timestamptz,
  end_date       timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_rounds_competition_id
  ON competition_rounds(competition_id);

ALTER TABLE competition_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competition_rounds_public_read ON competition_rounds;
CREATE POLICY competition_rounds_public_read
  ON competition_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS competition_rounds_service_all ON competition_rounds;
CREATE POLICY competition_rounds_service_all
  ON competition_rounds FOR ALL USING (auth.role() = 'service_role');

-- Competition FAQs
CREATE TABLE IF NOT EXISTS competition_faqs (
  id             uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid    NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  question       text    NOT NULL,
  answer         text    NOT NULL,
  order_index    integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_faqs_competition_id
  ON competition_faqs(competition_id);

ALTER TABLE competition_faqs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS competition_faqs_public_read ON competition_faqs;
CREATE POLICY competition_faqs_public_read
  ON competition_faqs FOR SELECT USING (true);

DROP POLICY IF EXISTS competition_faqs_service_all ON competition_faqs;
CREATE POLICY competition_faqs_service_all
  ON competition_faqs FOR ALL USING (auth.role() = 'service_role');

-- Competition entries status
ALTER TABLE competition_entries
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'registered',
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE competition_entries
  DROP CONSTRAINT IF EXISTS competition_entries_status_check;

ALTER TABLE competition_entries
  ADD CONSTRAINT competition_entries_status_check
    CHECK (status IN ('registered', 'shortlisted', 'winner', 'rejected'));
