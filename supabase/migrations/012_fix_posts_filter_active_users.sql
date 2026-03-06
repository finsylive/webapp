-- ============================================================
-- Fix: get_posts_with_counts — exclude posts from non-active users
-- This replaces/updates the existing RPC used by fetchPosts()
-- The function is called by the client-side supabase (anon key),
-- uses SECURITY DEFINER to bypass RLS, so we must filter manually.
-- ============================================================

CREATE OR REPLACE FUNCTION get_posts_with_counts(
  env_id UUID DEFAULT NULL,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  environment_id UUID,
  parent_post_id UUID,
  content TEXT,
  post_type TEXT,
  created_at TIMESTAMPTZ,
  deleted BOOLEAN,
  tags TEXT[],
  author JSONB,
  environment JSONB,
  media JSONB,
  poll JSONB,
  likes_count BIGINT,
  replies_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.environment_id,
    p.parent_post_id,
    p.content,
    p.post_type::TEXT,
    p.created_at,
    p.deleted,
    p.tags,
    -- Author info as JSON
    jsonb_build_object(
      'id',          u.id,
      'username',    u.username,
      'full_name',   u.full_name,
      'avatar_url',  u.avatar_url,
      'is_verified', COALESCE(u.is_verified, false)
    ) AS author,
    -- Environment info as JSON
    jsonb_build_object(
      'id',          e.id,
      'name',        e.name,
      'description', e.description,
      'picture',     e.picture
    ) AS environment,
    -- Media as JSON array
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id',              pm.id,
        'post_id',         pm.post_id,
        'media_url',       pm.media_url,
        'media_type',      pm.media_type,
        'media_thumbnail', pm.media_thumbnail,
        'width',           pm.width,
        'height',          pm.height,
        'created_at',      pm.created_at
      ) ORDER BY pm.created_at)
      FROM post_media pm
      WHERE pm.post_id = p.id),
      '[]'::jsonb
    ) AS media,
    -- Poll as JSON (null if no poll)
    (SELECT jsonb_build_object(
        'id',        pp.id,
        'post_id',   pp.post_id,
        'question',  pp.question,
        'poll_type', pp.poll_type,
        'created_at', pp.created_at,
        'options', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'id',          ppo.id,
            'poll_id',     ppo.poll_id,
            'option_text', ppo.option_text,
            'votes',       ppo.votes,
            'position',    ppo.position
          ) ORDER BY ppo.position)
          FROM post_poll_options ppo
          WHERE ppo.poll_id = pp.id),
          '[]'::jsonb
        )
      )
      FROM post_polls pp
      WHERE pp.post_id = p.id
      LIMIT 1
    ) AS poll,
    -- Likes count
    COALESCE(
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id),
      0
    ) AS likes_count,
    -- Replies count
    COALESCE(
      (SELECT COUNT(*) FROM posts r WHERE r.parent_post_id = p.id AND r.deleted = false),
      0
    ) AS replies_count
  FROM posts p
  -- ✅ KEY FIX: JOIN users and filter only active accounts
  INNER JOIN users u ON u.id = p.author_id AND u.account_status = 'active'
  LEFT JOIN environments e ON e.id = p.environment_id
  WHERE
    p.deleted = false
    AND p.parent_post_id IS NULL
    AND (env_id IS NULL OR p.environment_id = env_id)
  ORDER BY p.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- ============================================================
-- Also fix: get_post_with_counts (single post view)
-- Prevents viewing a post from a deactivated user via direct URL
-- ============================================================

CREATE OR REPLACE FUNCTION get_post_with_counts(
  post_id_param UUID
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  environment_id UUID,
  parent_post_id UUID,
  content TEXT,
  post_type TEXT,
  created_at TIMESTAMPTZ,
  deleted BOOLEAN,
  tags TEXT[],
  author JSONB,
  environment JSONB,
  media JSONB,
  poll JSONB,
  likes_count BIGINT,
  replies_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.environment_id,
    p.parent_post_id,
    p.content,
    p.post_type::TEXT,
    p.created_at,
    p.deleted,
    p.tags,
    jsonb_build_object(
      'id',          u.id,
      'username',    u.username,
      'full_name',   u.full_name,
      'avatar_url',  u.avatar_url,
      'is_verified', COALESCE(u.is_verified, false)
    ) AS author,
    jsonb_build_object(
      'id',          e.id,
      'name',        e.name,
      'description', e.description,
      'picture',     e.picture
    ) AS environment,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id',              pm.id,
        'post_id',         pm.post_id,
        'media_url',       pm.media_url,
        'media_type',      pm.media_type,
        'media_thumbnail', pm.media_thumbnail,
        'width',           pm.width,
        'height',          pm.height,
        'created_at',      pm.created_at
      ) ORDER BY pm.created_at)
      FROM post_media pm WHERE pm.post_id = p.id),
      '[]'::jsonb
    ) AS media,
    (SELECT jsonb_build_object(
        'id', pp.id, 'post_id', pp.post_id, 'question', pp.question,
        'poll_type', pp.poll_type, 'created_at', pp.created_at,
        'options', COALESCE(
          (SELECT jsonb_agg(jsonb_build_object(
            'id', ppo.id, 'poll_id', ppo.poll_id, 'option_text', ppo.option_text,
            'votes', ppo.votes, 'position', ppo.position
          ) ORDER BY ppo.position)
          FROM post_poll_options ppo WHERE ppo.poll_id = pp.id),
          '[]'::jsonb
        )
      )
      FROM post_polls pp WHERE pp.post_id = p.id LIMIT 1
    ) AS poll,
    COALESCE((SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id), 0) AS likes_count,
    COALESCE((SELECT COUNT(*) FROM posts r WHERE r.parent_post_id = p.id AND r.deleted = false), 0) AS replies_count
  FROM posts p
  -- ✅ KEY FIX: only return post if author is active
  INNER JOIN users u ON u.id = p.author_id AND u.account_status = 'active'
  LEFT JOIN environments e ON e.id = p.environment_id
  WHERE p.id = post_id_param
    AND p.deleted = false;
END;
$$;
