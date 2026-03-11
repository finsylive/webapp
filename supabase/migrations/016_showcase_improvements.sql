-- 016_showcase_improvements.sql
-- Atomic upsert functions + full-text search for startup_profiles

-- ═══════════════════════════════════════════════════════════════════
-- 1. Atomic upsert functions (delete + insert in one transaction)
-- ═══════════════════════════════════════════════════════════════════

-- Text Sections (max 20)
CREATE OR REPLACE FUNCTION upsert_startup_text_sections(
  p_startup_id UUID,
  p_sections JSONB
) RETURNS VOID AS $$
BEGIN
  IF jsonb_array_length(p_sections) > 20 THEN
    RAISE EXCEPTION 'Maximum 20 text sections allowed';
  END IF;

  DELETE FROM startup_text_sections WHERE startup_id = p_startup_id;

  IF jsonb_array_length(p_sections) > 0 THEN
    INSERT INTO startup_text_sections (startup_id, heading, content, display_order)
    SELECT
      p_startup_id,
      (item->>'heading')::TEXT,
      (item->>'content')::TEXT,
      (item->>'display_order')::INT
    FROM jsonb_array_elements(p_sections) AS item;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Links (max 30)
CREATE OR REPLACE FUNCTION upsert_startup_links(
  p_startup_id UUID,
  p_links JSONB
) RETURNS VOID AS $$
BEGIN
  IF jsonb_array_length(p_links) > 30 THEN
    RAISE EXCEPTION 'Maximum 30 links allowed';
  END IF;

  DELETE FROM startup_links WHERE startup_id = p_startup_id;

  IF jsonb_array_length(p_links) > 0 THEN
    INSERT INTO startup_links (startup_id, title, url, icon_name, display_order)
    SELECT
      p_startup_id,
      (item->>'title')::TEXT,
      (item->>'url')::TEXT,
      (item->>'icon_name')::TEXT,
      (item->>'display_order')::INT
    FROM jsonb_array_elements(p_links) AS item;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Slides (max 50)
CREATE OR REPLACE FUNCTION upsert_startup_slides(
  p_startup_id UUID,
  p_slides JSONB
) RETURNS VOID AS $$
BEGIN
  IF jsonb_array_length(p_slides) > 50 THEN
    RAISE EXCEPTION 'Maximum 50 slides allowed';
  END IF;

  DELETE FROM startup_slides WHERE startup_id = p_startup_id;

  IF jsonb_array_length(p_slides) > 0 THEN
    INSERT INTO startup_slides (startup_id, slide_url, caption, slide_number)
    SELECT
      p_startup_id,
      (item->>'slide_url')::TEXT,
      (item->>'caption')::TEXT,
      (item->>'slide_number')::INT
    FROM jsonb_array_elements(p_slides) AS item;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Full-text search vector on startup_profiles
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE startup_profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_startup_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.brand_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.elevator_pitch, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.key_strengths, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS startup_search_vector_update ON startup_profiles;
CREATE TRIGGER startup_search_vector_update
  BEFORE INSERT OR UPDATE ON startup_profiles
  FOR EACH ROW EXECUTE FUNCTION update_startup_search_vector();

CREATE INDEX IF NOT EXISTS idx_startup_search_vector ON startup_profiles USING gin(search_vector);

-- Backfill existing rows
UPDATE startup_profiles SET search_vector =
  setweight(to_tsvector('english', coalesce(brand_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(elevator_pitch, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(key_strengths, '')), 'D');
