# Level 2 Feed Engine — Setup Guide

Step-by-step instructions for enabling pg_cron background jobs and running the topic backfill on your self-hosted Supabase (EC2 + Postgres).

---

## Step 1: Enable pg_cron on Your EC2 Postgres

pg_cron is a Postgres extension that runs SQL on a schedule (like Linux cron, but inside the database). It's how the feed engine keeps its scoring tables populated.

### 1.1 SSH into Your EC2 Instance

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Find Your postgresql.conf

The location depends on your Postgres version. Common paths:

```bash
# Check which Postgres version is running
psql --version

# Common config file locations:
# Postgres 15: /etc/postgresql/15/main/postgresql.conf
# Postgres 16: /etc/postgresql/16/main/postgresql.conf
# Supabase Docker: /etc/postgresql/postgresql.conf

# If you can't find it, ask Postgres:
sudo -u postgres psql -c "SHOW config_file;"
```

### 1.3 Edit postgresql.conf

```bash
sudo nano /etc/postgresql/15/main/postgresql.conf
# (replace 15 with your actual version)
```

Find the line `shared_preload_libraries` (search with Ctrl+W in nano). It might look like:

```
shared_preload_libraries = ''
```

or

```
shared_preload_libraries = 'pg_stat_statements'
```

**Change it to include `pg_cron`:**

```
# If it was empty:
shared_preload_libraries = 'pg_cron'

# If it already had something:
shared_preload_libraries = 'pg_stat_statements,pg_cron'
```

Also add this line (anywhere in the file, or at the end):

```
cron.database_name = 'postgres'
```

> **How to find your database name:** Run `sudo -u postgres psql -c "SELECT current_database();"`. If your Supabase setup uses a different database name, use that instead of `postgres`.

Save and exit (Ctrl+X, then Y, then Enter in nano).

### 1.4 Restart Postgres

```bash
sudo systemctl restart postgresql
```

> **Downtime:** This causes a brief restart (~2-5 seconds). Plan for this during low-traffic time.

Verify it's back up:

```bash
sudo systemctl status postgresql
# Should show "active (running)"
```

### 1.5 Install the pg_cron Extension

Connect to your database:

```bash
sudo -u postgres psql
```

Or if your Supabase uses a specific database:

```bash
sudo -u postgres psql -d your_database_name
```

Run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
```

Verify it installed:

```sql
SELECT * FROM cron.job;
-- Should return 0 rows (no jobs yet), no errors
```

Type `\q` to exit psql.

### 1.6 If pg_cron Is Not Available

If you get an error like `could not open extension control file`, you need to install the package first:

```bash
# For Ubuntu/Debian with Postgres 15:
sudo apt-get update
sudo apt-get install postgresql-15-cron

# For Postgres 16:
sudo apt-get install postgresql-16-cron

# Then repeat steps 1.3 and 1.4
```

---

## Step 2: Run the pg_cron Migration

This creates the 5 scheduled background jobs that keep the feed engine's scoring tables populated.

### 2.1 Run the Migration File

From your EC2:

```bash
sudo -u postgres psql -d your_database_name -f /path/to/009_feed_level2_pgcron.sql
```

Or if you're running it from your local machine (with the SQL file), copy and paste the contents into your DB client (psql, pgAdmin, Supabase Studio SQL editor, etc.).

You can also run each section individually. Connect to psql and paste:

```sql
-- Job 1: Refresh Post Features (every 15 min)
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
```

```sql
-- Job 2: Refresh Interest Profiles (every hour)
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
```

```sql
-- Job 3: Compute Trending Topics (every 30 min)
SELECT cron.schedule(
  'compute-trending-topics',
  '*/30 * * * *',
  $$
  DELETE FROM trending_topics;

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
```

```sql
-- Job 4: Clean Up Old Data (daily at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-old-data',
  '0 3 * * *',
  $$
  DELETE FROM feed_events WHERE created_at < now() - interval '90 days';
  DELETE FROM feed_seen_posts WHERE seen_at < now() - interval '30 days';
  DELETE FROM feed_cache WHERE expires_at < now();
  DELETE FROM user_sessions WHERE last_active_at < now() - interval '7 days';
  $$
);
```

```sql
-- Job 5: Aggregate Daily Analytics (daily at 1 AM UTC)
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
```

### 2.2 Verify Jobs Were Created

```sql
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
```

Expected output:

```
 jobid |         jobname              |  schedule     | active
-------+------------------------------+---------------+--------
     1 | refresh-post-features        | */15 * * * *  | t
     2 | refresh-interest-profiles    | 0 * * * *     | t
     3 | compute-trending-topics      | */30 * * * *  | t
     4 | cleanup-old-data             | 0 3 * * *     | t
     5 | aggregate-daily-analytics    | 0 1 * * *     | t
```

All 5 jobs should show `active = t`.

### 2.3 Check Job Run History (After Jobs Have Had Time to Run)

```sql
-- See recent job runs
SELECT jobid, jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

`status = 'succeeded'` means it worked. If you see `'failed'`, check `return_message` for the error.

---

## Step 3: Run the Topic Backfill

This tags all existing posts with topic keywords so the feed's topic matching (10% of ranking) works for old content.

### 3.1 Prerequisites

Make sure your `.env` file has these (you already have them):

```
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

> **Important:** The backfill script uses `SUPABASE_SERVICE_ROLE_KEY` (without the `NEXT_PUBLIC_` prefix). Check if your `.env` has this key. If you only have `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`, add a non-prefixed copy:
>
> ```
> SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
> ```

### 3.2 Install tsx (If Not Already Installed)

```bash
# Check if tsx is available
npx tsx --version

# If not, install globally (optional — npx handles it automatically)
npm install -g tsx
```

### 3.3 Run the Backfill

From your project root:

```bash
npx tsx scripts/backfill-topics.ts
```

Expected output:

```
Fetching posts without embeddings...
Found 127 total posts, 0 already have embeddings.
Processing 127 posts...
  Progress: 50 stored, 3 skipped (no topics)...
  Progress: 100 stored, 5 skipped (no topics)...

Backfill complete: 122 stored, 5 skipped.
```

It takes ~1-2 seconds per 100 posts. Safe to re-run — it skips posts that already have embeddings.

### 3.4 Verify the Backfill Worked

Connect to your database and run:

```sql
-- Count how many posts now have topic tags
SELECT COUNT(*) FROM content_embeddings;

-- See a sample of tagged posts
SELECT post_id, topics, keywords FROM content_embeddings LIMIT 5;

-- Check topic distribution
SELECT unnest(topics) as topic, COUNT(*) as count
FROM content_embeddings
GROUP BY topic
ORDER BY count DESC;
```

---

## Step 4: Verify Everything Is Working Together

### 4.1 Check That Post Features Are Being Computed

Wait 15 minutes after setting up pg_cron, then:

```sql
SELECT COUNT(*) FROM post_features;
-- Should be > 0 (up to 200 recent posts)

SELECT post_id, engagement_score, virality_velocity, content_quality
FROM post_features
ORDER BY engagement_score DESC
LIMIT 5;
```

### 4.2 Check That Interest Profiles Are Being Built

Wait 1 hour (or manually trigger for a test user):

```sql
-- Manual trigger for a specific user:
SELECT compute_user_interest_profile('your-user-uuid-here');

-- Check the result:
SELECT user_id, topic_scores, creator_affinities, computed_at
FROM user_interest_profiles
LIMIT 5;
```

### 4.3 Check That Trending Topics Are Populated

Wait 30 minutes, then:

```sql
SELECT topic, post_count, velocity, status
FROM trending_topics
ORDER BY velocity DESC;
```

### 4.4 Check Feed Pipeline Logs

Open your app, load the feed, and check your server logs. You should see:

```
# Cache miss (first load, runs full pipeline):
[Feed Pipeline] user=abc12345 total=476ms | candidates=298ms(187) → profile=5ms[loaded] → features=162ms(187) → tier1=2ms(187) → diversity=1ms(187)

# Cache hit (subsequent loads):
[Feed] Cache HIT for user=abc12345 posts=20
```

---

## Troubleshooting

### pg_cron jobs not running

```sql
-- Check if cron extension is active
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check if jobs are active
SELECT jobname, active FROM cron.job;

-- Check recent failures
SELECT jobname, status, return_message
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 5;
```

### "compute_post_features" or "compute_user_interest_profile" not found

These RPC functions come from migration `002_feed_rpc_functions.sql`. Make sure that migration has been applied:

```sql
-- Check if the function exists
SELECT proname FROM pg_proc WHERE proname = 'compute_post_features';
SELECT proname FROM pg_proc WHERE proname = 'compute_user_interest_profile';
```

If they don't exist, run `002_feed_rpc_functions.sql` first.

### Backfill script fails with "Missing SUPABASE_SERVICE_ROLE_KEY"

Your `.env` likely only has `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`. Add:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

The script reads the non-prefixed version because `NEXT_PUBLIC_` variables are only for browser-side code.

### Redis not being used (everything going to Postgres)

Check that your `.env` has both:

```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

The `getRedis()` function in `src/lib/feed/redis.ts` returns `null` if either is missing, and the pipeline silently falls back to Postgres.

### How to pause a specific job

```sql
-- Pause a job (keeps it but stops running)
UPDATE cron.job SET active = false WHERE jobname = 'refresh-post-features';

-- Resume it
UPDATE cron.job SET active = true WHERE jobname = 'refresh-post-features';
```

### How to remove a job

```sql
SELECT cron.unschedule('refresh-post-features');
```

### How to run a job manually right now

```sql
-- Trigger post features refresh immediately
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
```

---

## Summary Checklist

- [ ] SSH into EC2
- [ ] Edit `postgresql.conf` — add `pg_cron` to `shared_preload_libraries` and set `cron.database_name`
- [ ] Restart Postgres
- [ ] Run `CREATE EXTENSION IF NOT EXISTS pg_cron;`
- [ ] Run the 5 cron job SQL statements (from `009_feed_level2_pgcron.sql`)
- [ ] Verify with `SELECT * FROM cron.job;` (should show 5 active jobs)
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` (without `NEXT_PUBLIC_` prefix) if not already there
- [ ] Run `npx tsx scripts/backfill-topics.ts`
- [ ] Verify `content_embeddings` table has data
- [ ] Wait 15 min, verify `post_features` table has data
- [ ] Load the feed, check server logs for pipeline timing
