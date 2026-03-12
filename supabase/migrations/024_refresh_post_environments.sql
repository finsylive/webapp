-- 024_refresh_post_environments.sql
-- Replace legacy environments with startup-platform aligned spaces.
-- Final set: 12 environments (stage-based + topic-based + engagement)

DO $$
DECLARE
  general_env_id UUID;
BEGIN

  -- ── Create new environments ──────────────────────────────────────────────

  INSERT INTO public.environments (name, description)
  SELECT 'General', 'Updates, thoughts, and broad platform discussion.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'general');

  INSERT INTO public.environments (name, description)
  SELECT 'Ideation', 'Ideas, validation, brainstorming, and problem discovery.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'ideation');

  INSERT INTO public.environments (name, description)
  SELECT 'MVP', 'Building v1, early users, feedback loops, and pivots.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'mvp');

  INSERT INTO public.environments (name, description)
  SELECT 'Scaling', 'Growth, metrics, hiring, ops, and product-market fit.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'scaling');

  INSERT INTO public.environments (name, description)
  SELECT 'Marketing', 'GTM strategy, branding, content, growth hacking, and distribution.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'marketing');

  INSERT INTO public.environments (name, description)
  SELECT 'Investing', 'Fundraising, deal flow, market views, and investor thinking.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'investing');

  INSERT INTO public.environments (name, description)
  SELECT 'Builders', 'Product, engineering, design, shipping, and practical execution.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'builders');

  INSERT INTO public.environments (name, description)
  SELECT 'Campus', 'Student founders, e-cells, university incubators, and campus entrepreneurship.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'campus');

  INSERT INTO public.environments (name, description)
  SELECT 'Opportunities', 'Jobs, gigs, grants, competitions, and open asks.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'opportunities');

  INSERT INTO public.environments (name, description)
  SELECT 'AI & Tech', 'AI, emerging tech, tools, and technical deep-dives.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'ai & tech');

  INSERT INTO public.environments (name, description)
  SELECT 'Resources', 'Tools, templates, guides, frameworks, and recommended reads.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'resources');

  INSERT INTO public.environments (name, description)
  SELECT 'Hot Takes', 'Spicy opinions, debates, and controversial startup takes.'
  WHERE NOT EXISTS (SELECT 1 FROM public.environments WHERE lower(name) = 'hot takes');

  -- ── Ensure descriptions are up-to-date ───────────────────────────────────

  UPDATE public.environments
  SET description = CASE lower(name)
    WHEN 'general'       THEN 'Updates, thoughts, and broad platform discussion.'
    WHEN 'ideation'      THEN 'Ideas, validation, brainstorming, and problem discovery.'
    WHEN 'mvp'           THEN 'Building v1, early users, feedback loops, and pivots.'
    WHEN 'scaling'       THEN 'Growth, metrics, hiring, ops, and product-market fit.'
    WHEN 'marketing'     THEN 'GTM strategy, branding, content, growth hacking, and distribution.'
    WHEN 'investing'     THEN 'Fundraising, deal flow, market views, and investor thinking.'
    WHEN 'builders'      THEN 'Product, engineering, design, shipping, and practical execution.'
    WHEN 'campus'        THEN 'Student founders, e-cells, university incubators, and campus entrepreneurship.'
    WHEN 'opportunities' THEN 'Jobs, gigs, grants, competitions, and open asks.'
    WHEN 'ai & tech'     THEN 'AI, emerging tech, tools, and technical deep-dives.'
    WHEN 'resources'     THEN 'Tools, templates, guides, frameworks, and recommended reads.'
    WHEN 'hot takes'     THEN 'Spicy opinions, debates, and controversial startup takes.'
    ELSE description
  END
  WHERE lower(name) IN (
    'general', 'ideation', 'mvp', 'scaling', 'marketing',
    'investing', 'builders', 'campus', 'opportunities',
    'ai & tech', 'resources', 'hot takes'
  );

  -- ── Migrate old posts to General ─────────────────────────────────────────

  SELECT id INTO general_env_id
  FROM public.environments
  WHERE lower(name) = 'general'
  ORDER BY created_at ASC
  LIMIT 1;

  UPDATE public.posts
  SET environment_id = general_env_id
  WHERE environment_id IN (
    SELECT id FROM public.environments
    WHERE lower(name) IN (
      'ai', 'app_dev', 'collaboration', 'data_science',
      'idea_validation', 'memes', 'politics', 'random',
      'startups', 'support', 'local ecosystems'
    )
  );

  -- ── Delete legacy environments ───────────────────────────────────────────

  DELETE FROM public.environments
  WHERE lower(name) IN (
    'ai', 'app_dev', 'collaboration', 'data_science',
    'idea_validation', 'memes', 'politics', 'random',
    'startups', 'support', 'local ecosystems'
  );

END $$;
