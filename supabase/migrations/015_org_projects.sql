-- 015_org_projects.sql
-- Adds entity_type support to startup_profiles (Approach E: Pragmatic Hybrid)
-- Org projects and startups share the same table; entity_type distinguishes them.

-- 1. Add entity_type and parent_org_id columns
ALTER TABLE startup_profiles
  ADD COLUMN IF NOT EXISTS entity_type TEXT NOT NULL DEFAULT 'startup'
    CHECK (entity_type IN ('org_project', 'startup')),
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Relax NOT NULL on startup-only contact fields (org projects don't need them)
ALTER TABLE startup_profiles
  ALTER COLUMN startup_email DROP NOT NULL,
  ALTER COLUMN startup_phone DROP NOT NULL;

-- 3. Create startup_slides table (showcase gallery)
CREATE TABLE IF NOT EXISTS startup_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  slide_url TEXT NOT NULL,
  caption TEXT,
  slide_number INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_slides_startup_id ON startup_slides(startup_id);

-- 4. Create startup_links table (additional links beyond website)
CREATE TABLE IF NOT EXISTS startup_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_name TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_links_startup_id ON startup_links(startup_id);

-- 5. Create startup_text_sections table (case study / write-up sections)
CREATE TABLE IF NOT EXISTS startup_text_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id UUID NOT NULL REFERENCES startup_profiles(id) ON DELETE CASCADE,
  heading TEXT NOT NULL,
  content TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_text_sections_startup_id ON startup_text_sections(startup_id);

-- 6. RLS policies for new tables
ALTER TABLE startup_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_text_sections ENABLE ROW LEVEL SECURITY;

-- Read: anyone can read slides/links/sections for published startups
CREATE POLICY "Anyone can read startup slides" ON startup_slides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_slides.startup_id
      AND sp.is_published = true
    )
  );

CREATE POLICY "Anyone can read startup links" ON startup_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_links.startup_id
      AND sp.is_published = true
    )
  );

CREATE POLICY "Anyone can read startup text sections" ON startup_text_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_text_sections.startup_id
      AND sp.is_published = true
    )
  );

-- Write: only the startup owner can insert/update/delete
CREATE POLICY "Owner can manage startup slides" ON startup_slides
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_slides.startup_id
      AND sp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage startup links" ON startup_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_links.startup_id
      AND sp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can manage startup text sections" ON startup_text_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM startup_profiles sp
      WHERE sp.id = startup_text_sections.startup_id
      AND sp.owner_id = auth.uid()
    )
  );

-- 7. Index on entity_type for filtered queries
CREATE INDEX IF NOT EXISTS idx_startup_profiles_entity_type ON startup_profiles(entity_type);
