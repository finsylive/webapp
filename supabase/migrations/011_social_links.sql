-- Add social_links JSONB column to users table
-- Stores portfolio/social platform links: { github, linkedin, dribbble, behance, youtube, figma, website, substack }
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT NULL;
