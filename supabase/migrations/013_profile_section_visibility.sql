-- Add section visibility toggles to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS show_projects boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_startups boolean NOT NULL DEFAULT true;
