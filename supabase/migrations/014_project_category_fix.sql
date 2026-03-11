-- Fix project category: was incorrectly a UUID FK to environments table.
-- Categories are now plain text strings (e.g. "Web App", "AI / ML").

-- 1. Drop the foreign key constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_category_fkey;

-- 2. Change column type from UUID to TEXT
ALTER TABLE public.projects ALTER COLUMN category TYPE TEXT USING category::TEXT;

-- 3. Replace stale UUID values with 'Other' — they referenced environments rows
--    which are unrelated to project categories. Regex matches UUID v4 format.
--    We use 'Other' (not NULL) because the column is NOT NULL.
UPDATE public.projects
SET category = 'Other'
WHERE category ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
