-- ============================================================
-- Migration: Complete event system setup
-- Run this in Supabase SQL editor
-- ============================================================

-- 1. Create the events table (if it doesn't exist yet)
CREATE TABLE IF NOT EXISTS events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date timestamptz,
  location text,
  event_url text,
  banner_image_url text,
  event_type text NOT NULL DEFAULT 'online'
    CHECK (event_type IN ('online', 'in-person', 'hybrid')),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Safe: only creates if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Public read access for events'
  ) THEN
    CREATE POLICY "Public read access for events"
      ON events FOR SELECT USING (true);
  END IF;
END $$;

-- 2. Add 'category' column to events table for sub-categorization
--    Values: 'event' (default), 'meetup', 'workshop'
ALTER TABLE events ADD COLUMN IF NOT EXISTS category text DEFAULT 'event';

-- Add check constraint separately (safe if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'events_category_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_category_check
      CHECK (category IN ('event', 'meetup', 'workshop'));
  END IF;
END $$;

-- 3. Create event_participants table for tracking event registrations
CREATE TABLE IF NOT EXISTS event_participants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for event_participants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_participants' AND policyname = 'Public read access for event_participants'
  ) THEN
    CREATE POLICY "Public read access for event_participants"
      ON event_participants FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_participants' AND policyname = 'Users can join events'
  ) THEN
    CREATE POLICY "Users can join events"
      ON event_participants FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'event_participants' AND policyname = 'Users can leave events'
  ) THEN
    CREATE POLICY "Users can leave events"
      ON event_participants FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- 4. Ensure competition_entries has proper RLS policies for the Join button
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competition_entries' AND policyname = 'Public read access for competition_entries'
  ) THEN
    CREATE POLICY "Public read access for competition_entries"
      ON competition_entries FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'competition_entries' AND policyname = 'Users can join competitions'
  ) THEN
    CREATE POLICY "Users can join competitions"
      ON competition_entries FOR INSERT
      WITH CHECK (auth.uid() = submitted_by);
  END IF;
END $$;
