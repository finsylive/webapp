-- Add sort_order column to projects table for manual ordering
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Initialize sort_order based on created_at ordering per owner
-- so existing projects keep their chronological order
UPDATE public.projects p
SET sort_order = subq.rn
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY owner_id ORDER BY created_at ASC) AS rn
  FROM public.projects
) subq
WHERE p.id = subq.id;

-- Index for efficient ordering queries
CREATE INDEX IF NOT EXISTS idx_projects_owner_sort
  ON public.projects (owner_id, sort_order, created_at);
