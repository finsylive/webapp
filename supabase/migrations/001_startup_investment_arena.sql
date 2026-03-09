-- ============================================================
-- Startup Investment Arena — Event Extension
-- ============================================================

-- 1. Add arena-related columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS entry_type TEXT DEFAULT NULL
    CHECK (entry_type IN ('startup', 'project')),
  ADD COLUMN IF NOT EXISTS arena_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS virtual_fund_amount BIGINT DEFAULT 1000000,
  ADD COLUMN IF NOT EXISTS arena_round TEXT DEFAULT NULL
    CHECK (arena_round IN ('registration', 'investment', 'completed'));

-- 2. Event stalls — startups/projects registered for an event (Round 1)
CREATE TABLE IF NOT EXISTS event_stalls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  stall_name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  demo_url TEXT,
  pitch_deck_url TEXT,
  logo_url TEXT,
  category TEXT,
  startup_id UUID,  -- optional link to startup_profiles
  project_id UUID,  -- optional link to projects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 3. Event audience — users who register as investors (Round 2)
--    Only users who are NOT stall owners can register as audience
CREATE TABLE IF NOT EXISTS event_audience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  virtual_balance BIGINT NOT NULL DEFAULT 1000000,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- 4. Event investments — audience invests in stalls
CREATE TABLE IF NOT EXISTS event_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stall_id UUID NOT NULL REFERENCES event_stalls(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  invested_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_stalls_event ON event_stalls(event_id);
CREATE INDEX IF NOT EXISTS idx_event_audience_event ON event_audience(event_id);
CREATE INDEX IF NOT EXISTS idx_event_investments_event ON event_investments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_investments_stall ON event_investments(stall_id);
CREATE INDEX IF NOT EXISTS idx_event_investments_investor ON event_investments(investor_id);

-- 6. RLS policies
ALTER TABLE event_stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_audience ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_investments ENABLE ROW LEVEL SECURITY;

-- Public read for all arena tables
CREATE POLICY "Anyone can read stalls" ON event_stalls FOR SELECT USING (true);
CREATE POLICY "Anyone can read audience" ON event_audience FOR SELECT USING (true);
CREATE POLICY "Anyone can read investments" ON event_investments FOR SELECT USING (true);

-- Authenticated users can insert their own records
CREATE POLICY "Users can create stalls" ON event_stalls
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own stalls" ON event_stalls
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own stalls" ON event_stalls
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can join as audience" ON event_audience
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audience balance" ON event_audience
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can invest" ON event_investments
  FOR INSERT WITH CHECK (auth.uid() = investor_id);
