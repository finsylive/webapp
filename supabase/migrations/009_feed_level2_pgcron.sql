-- Level 2 Feed Engine: pg_cron Background Jobs
-- Requires pg_cron extension to be enabled in postgresql.conf:
--   shared_preload_libraries = 'pg_cron'
--   cron.database_name = 'your_database_name'
-- Then restart Postgres and run: CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to the default postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- ============================================================
-- Job 1: Refresh Post Features (every 15 minutes)
-- Recomputes engagement_score, virality_velocity, content_quality
-- for posts from the last 3 days. Without this, 25% of ranking = 0.
-- ============================================================
SELECT cron.schedule(
  'refresh-post-features',
  '*/15 * * * *',
  $$
  DO $job$
  DECLARE
    post_record RECORD;
  BEGIN
    FOR post_record IN
      SELECT id FROM posts
      WHERE created_at > now() - interval '3 days'
        AND deleted = false
      ORDER BY created_at DESC
      LIMIT 200
    LOOP
      PERFORM compute_post_features(post_record.id);
    END LOOP;
  END $job$;
  $$
);

-- ============================================================
-- Job 2: Refresh User Interest Profiles (every hour)
-- Rebuilds topic_scores, creator_affinities, interaction_patterns
-- for users active in the last 24 hours. Without this, the feed
-- doesn't know what users care about (10%+ of ranking = 0).
-- ============================================================
SELECT cron.schedule(
  'refresh-interest-profiles',
  '0 * * * *',
  $$
  DO $job$
  DECLARE
    user_record RECORD;
  BEGIN
    FOR user_record IN
      SELECT DISTINCT user_id FROM user_sessions
      WHERE last_active_at > now() - interval '24 hours'
      LIMIT 500
    LOOP
      PERFORM compute_user_interest_profile(user_record.user_id);
    END LOOP;
  END $job$;
  $$
);

-- ============================================================
-- Job 3: Compute Trending Topics (every 30 minutes)
-- Populates the trending_topics table from recent post engagement.
-- ============================================================
SELECT cron.schedule(
  'compute-trending-topics',
  '*/30 * * * *',
  $$
  -- Clear old trending data
  DELETE FROM trending_topics;

  -- Compute from recent posts with embeddings
  INSERT INTO trending_topics (topic, post_count, engagement_sum, velocity, first_seen_at, last_seen_at, status)
  SELECT
    unnest(ce.topics) as topic,
    COUNT(DISTINCT ce.post_id) as post_count,
    SUM(COALESCE(pf.engagement_score, 0) + 1) as engagement_sum,
    SUM(COALESCE(pf.engagement_score, 0) + 1) / GREATEST(1, EXTRACT(EPOCH FROM (now() - MIN(p.created_at))) / 3600) as velocity,
    MIN(p.created_at) as first_seen_at,
    MAX(p.created_at) as last_seen_at,
    'rising' as status
  FROM content_embeddings ce
  JOIN posts p ON p.id = ce.post_id
  LEFT JOIN post_features pf ON pf.post_id = ce.post_id
  WHERE p.created_at > now() - interval '24 hours'
    AND p.deleted = false
    AND ce.topics IS NOT NULL
    AND array_length(ce.topics, 1) > 0
  GROUP BY unnest(ce.topics)
  HAVING COUNT(DISTINCT ce.post_id) >= 2
  ORDER BY velocity DESC
  LIMIT 20
  ON CONFLICT (topic) DO UPDATE SET
    post_count = EXCLUDED.post_count,
    engagement_sum = EXCLUDED.engagement_sum,
    velocity = EXCLUDED.velocity,
    last_seen_at = EXCLUDED.last_seen_at;
  $$
);

-- ============================================================
-- Job 4: Clean Up Old Data (daily at 3 AM UTC)
-- Prunes old events, seen posts, expired cache, stale sessions.
-- ============================================================
SELECT cron.schedule(
  'cleanup-old-data',
  '0 3 * * *',
  $$
  -- Delete events older than 90 days
  DELETE FROM feed_events WHERE created_at < now() - interval '90 days';

  -- Delete seen posts older than 30 days
  DELETE FROM feed_seen_posts WHERE seen_at < now() - interval '30 days';

  -- Delete expired cache entries
  DELETE FROM feed_cache WHERE expires_at < now();

  -- Delete stale sessions (inactive > 7 days)
  DELETE FROM user_sessions WHERE last_active_at < now() - interval '7 days';
  $$
);

-- ============================================================
-- Job 5: Aggregate Daily Analytics (daily at 1 AM UTC)
-- Summarizes yesterday's feed metrics into feed_analytics_daily.
-- ============================================================
SELECT cron.schedule(
  'aggregate-daily-analytics',
  '0 1 * * *',
  $$
  INSERT INTO feed_analytics_daily (date, total_impressions, total_engagements, unique_users, avg_dwell_ms, engagement_rate)
  SELECT
    (now() - interval '1 day')::date as date,
    COUNT(*) FILTER (WHERE event_type = 'impression') as total_impressions,
    COUNT(*) FILTER (WHERE event_type IN ('like', 'reply', 'share', 'bookmark', 'click')) as total_engagements,
    COUNT(DISTINCT user_id) as unique_users,
    AVG((metadata->>'dwell_ms')::numeric) FILTER (WHERE event_type = 'dwell' AND metadata->>'dwell_ms' IS NOT NULL) as avg_dwell_ms,
    CASE
      WHEN COUNT(*) FILTER (WHERE event_type = 'impression') > 0
      THEN COUNT(*) FILTER (WHERE event_type IN ('like', 'reply', 'share', 'bookmark', 'click'))::numeric
           / COUNT(*) FILTER (WHERE event_type = 'impression')
      ELSE 0
    END as engagement_rate
  FROM feed_events
  WHERE created_at >= (now() - interval '1 day')::date
    AND created_at < now()::date
  ON CONFLICT (date) DO UPDATE SET
    total_impressions = EXCLUDED.total_impressions,
    total_engagements = EXCLUDED.total_engagements,
    unique_users = EXCLUDED.unique_users,
    avg_dwell_ms = EXCLUDED.avg_dwell_ms,
    engagement_rate = EXCLUDED.engagement_rate;
  $$
);
