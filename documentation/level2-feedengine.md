# Level 2 Feed Engine — Complete Implementation Guide

> Everything needed to go from "broken pipeline" to "sub-20ms cached, background-refreshed, observable feed" in 3-5 days.

---

## What Level 2 Is

Level 2 takes the existing feed engine (which is fully coded but not running properly) and makes it production-ready by adding:

1. **Upstash Redis** — feed cache + interest profiles in Redis instead of Postgres (5-20ms vs 50-150ms)
2. **pg_cron background jobs** — keep `post_features`, `user_interest_profiles`, `content_embeddings` populated
3. **Keyword extraction on post create** — fill `content_embeddings` table so topic matching works
4. **Reliable interaction graph updates** — on event flush, with retry
5. **Pipeline observability** — structured timing logs per stage, per request
6. **Vercel Cron** — daily analytics aggregation + trending topics computation

**What Level 2 is NOT:** It doesn't change the ranking algorithm, scoring weights, or pipeline stages. Same Tier 1 math, same Groq Tier 2 (optional), same diversity rules. We're fixing the infrastructure underneath, not the algorithm on top.

---

## Prerequisites

```
You need:
  ✓ Supabase self-hosted on AWS (EC2 + Postgres) — already have this
  ✓ GROQ_API_KEY in .env (optional — Tier 2 works without it, just skips LLM)
  ✓ Upstash account (free tier is enough)
  ✓ pg_cron extension enabled in Postgres
  ✓ Vercel project (for cron — or use pg_cron for everything if not on Vercel)
```

---

## Part 1: Upstash Redis Caching Layer

### Why Redis

The current cache lives in the `feed_cache` Postgres table. Every cache check is a DB round-trip:

```
Current:  Client → API → Postgres (feed_cache table) → parse → return
          ~50-150ms per cache hit

Level 2:  Client → API → Upstash Redis → return
          ~5-20ms per cache hit
```

At 80% cache hit rate, this means 80% of your feed requests go from 150ms to 20ms.

### 1.1 Install Upstash SDK

```bash
npm install @upstash/redis
```

### 1.2 Create Redis Client

**New file: `src/lib/feed/redis.ts`**

```typescript
import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return redisClient;
}
```

**Add to `.env`:**
```
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### 1.3 Redis Key Schema

```
feed:cache:{userId}           → JSON { post_ids: string[], scores: number[], computed_at: string, experiment_id, variant }
feed:cache:{userId}:ttl       → auto-expires (SET with EX 7200 = 2 hours)
feed:profile:{userId}         → JSON { topic_scores, content_type_preferences, creator_affinities, interaction_patterns, computed_at }
feed:profile:{userId}:ttl     → auto-expires (SET with EX 3600 = 1 hour)
feed:trending                 → JSON { topics: { name, score, post_count }[] }
feed:trending:ttl              → auto-expires (SET with EX 1800 = 30 min)
```

### 1.4 Modify `cache-manager.ts`

The current file is `src/lib/feed/cache-manager.ts` (93 lines). Here's exactly what changes:

**Current `getCachedFeed` flow:**
```
1. Query Postgres: SELECT * FROM feed_cache WHERE user_id = ? AND expires_at > now()
2. Parse post_ids, scores arrays
3. Apply cursor pagination
4. Return page
```

**New flow:**
```
1. Try Redis: GET feed:cache:{userId}
2. If hit → parse JSON, apply cursor pagination, return
3. If miss → fall through to Postgres (existing code, unchanged)
4. If Postgres hit → write back to Redis (SET with EX 7200)
5. Return page
```

**Modified `src/lib/feed/cache-manager.ts`:**

```typescript
import { createAdminClient } from '@/utils/supabase-server';
import type { FeedCacheEntry, ScoredPost } from './types';
import { CACHE_TTL_HOURS, FEED_PAGE_SIZE } from './constants';
import { getRedis } from './redis';

interface RedisFeedCache {
  post_ids: string[];
  scores: number[];
  computed_at: string;
  experiment_id: string | null;
  variant: string | null;
}

/**
 * Get cached feed — tries Redis first, falls back to Postgres.
 */
export async function getCachedFeed(
  userId: string,
  cursor?: string
): Promise<{ posts: string[]; scores: number[]; hasMore: boolean; entry: FeedCacheEntry } | null> {
  // Try Redis first
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<RedisFeedCache>(`feed:cache:${userId}`);
      if (cached && cached.post_ids && cached.post_ids.length > 0) {
        const { pagePostIds, pageScores, hasMore, startIndex } = paginateCache(
          cached.post_ids,
          cached.scores,
          cursor
        );

        return {
          posts: pagePostIds,
          scores: pageScores,
          hasMore,
          entry: {
            user_id: userId,
            post_ids: cached.post_ids,
            scores: cached.scores,
            computed_at: cached.computed_at,
            expires_at: '', // Not needed, Redis handles TTL
            version: 1,
            experiment_id: cached.experiment_id,
            variant: cached.variant,
          } as FeedCacheEntry,
        };
      }
    } catch (err) {
      console.warn('[Feed] Redis cache read failed, falling back to Postgres:', err);
    }
  }

  // Fall back to Postgres (existing logic, unchanged)
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feed_cache')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('computed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const entry = data as FeedCacheEntry;
  if (!entry.post_ids || entry.post_ids.length === 0) return null;

  const { pagePostIds, pageScores, hasMore } = paginateCache(
    entry.post_ids,
    entry.scores,
    cursor
  );

  // Write back to Redis for next time
  if (redis) {
    try {
      await redis.set(
        `feed:cache:${userId}`,
        {
          post_ids: entry.post_ids,
          scores: entry.scores,
          computed_at: entry.computed_at,
          experiment_id: entry.experiment_id || null,
          variant: entry.variant || null,
        } satisfies RedisFeedCache,
        { ex: CACHE_TTL_HOURS * 3600 }
      );
    } catch {
      // Non-critical — Postgres cache is the source of truth
    }
  }

  return { posts: pagePostIds, scores: pageScores, hasMore, entry };
}

/**
 * Paginate a cached feed using cursor.
 */
function paginateCache(
  allPostIds: string[],
  allScores: number[],
  cursor?: string
): { pagePostIds: string[]; pageScores: number[]; hasMore: boolean; startIndex: number } {
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = allPostIds.indexOf(cursor);
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }

  const pagePostIds = allPostIds.slice(startIndex, startIndex + FEED_PAGE_SIZE);
  const pageScores = allScores.slice(startIndex, startIndex + FEED_PAGE_SIZE);
  const hasMore = startIndex + FEED_PAGE_SIZE < allPostIds.length;

  return { pagePostIds, pageScores, hasMore, startIndex };
}

/**
 * Write ranked feed to both Redis and Postgres.
 */
export async function writeFeedCache(
  userId: string,
  scoredPosts: ScoredPost[],
  experimentId?: string | null,
  variant?: string | null
): Promise<void> {
  const postIds = scoredPosts.map((s) => s.post_id);
  const scores = scoredPosts.map((s) => s.score);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  // Write to Redis (fast, primary cache)
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(
        `feed:cache:${userId}`,
        {
          post_ids: postIds,
          scores,
          computed_at: now.toISOString(),
          experiment_id: experimentId || null,
          variant: variant || null,
        } satisfies RedisFeedCache,
        { ex: CACHE_TTL_HOURS * 3600 }
      );
    } catch (err) {
      console.warn('[Feed] Redis cache write failed:', err);
    }
  }

  // Write to Postgres (durable, backup)
  const supabase = createAdminClient();
  await supabase.from('feed_cache').delete().eq('user_id', userId);
  await supabase.from('feed_cache').insert({
    user_id: userId,
    post_ids: postIds,
    scores,
    computed_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    version: 1,
    experiment_id: experimentId || null,
    variant: variant || null,
  });
}

/**
 * Invalidate feed cache (both Redis and Postgres).
 */
export async function invalidateFeedCache(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`feed:cache:${userId}`);
    } catch {
      // Non-critical
    }
  }
  const supabase = createAdminClient();
  await supabase.from('feed_cache').delete().eq('user_id', userId);
}
```

### 1.5 Modify `interest-profile.ts` — Add Redis Layer

**Current flow:** in-memory Map → Postgres → RPC recompute
**New flow:** in-memory Map → Redis → Postgres → RPC recompute → write back to Redis

```typescript
import type { UserInterestProfile } from './types';
import { INTEREST_PROFILE_STALE_HOURS } from './constants';
import { createAdminClient } from '@/utils/supabase-server';
import { getRedis } from './redis';

// In-memory cache (per-process, cleared on deploy)
const profileCache = new Map<string, { profile: UserInterestProfile; fetchedAt: number }>();

const STALE_MS = INTEREST_PROFILE_STALE_HOURS * 60 * 60 * 1000;

export async function getUserInterestProfile(userId: string): Promise<UserInterestProfile | null> {
  // Layer 1: In-memory (same process, <1ms)
  const memCached = profileCache.get(userId);
  if (memCached && Date.now() - memCached.fetchedAt < STALE_MS) {
    return memCached.profile;
  }

  // Layer 2: Redis (~5ms)
  const redis = getRedis();
  if (redis) {
    try {
      const redisCached = await redis.get<UserInterestProfile>(`feed:profile:${userId}`);
      if (redisCached && redisCached.computed_at) {
        const computedAt = new Date(redisCached.computed_at).getTime();
        if (Date.now() - computedAt < STALE_MS) {
          profileCache.set(userId, { profile: redisCached, fetchedAt: Date.now() });
          return redisCached;
        }
      }
    } catch {
      // Fall through to Postgres
    }
  }

  // Layer 3: Postgres (~50ms)
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('user_interest_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const computedAt = new Date(existing.computed_at).getTime();
    const isStale = Date.now() - computedAt > STALE_MS;

    if (!isStale) {
      const profile = existing as UserInterestProfile;
      await cacheProfile(userId, profile);
      return profile;
    }
  }

  // Layer 4: Recompute via RPC
  try {
    await supabase.rpc('compute_user_interest_profile', { p_user_id: userId });
    const { data: fresh } = await supabase
      .from('user_interest_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fresh) {
      const profile = fresh as UserInterestProfile;
      await cacheProfile(userId, profile);
      return profile;
    }
  } catch (error) {
    console.warn('[Feed] Failed to compute interest profile:', error);
  }

  // Return stale data rather than nothing
  if (existing) {
    const profile = existing as UserInterestProfile;
    await cacheProfile(userId, profile);
    return profile;
  }

  return null;
}

async function cacheProfile(userId: string, profile: UserInterestProfile) {
  // Memory
  profileCache.set(userId, { profile, fetchedAt: Date.now() });
  // Redis
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`feed:profile:${userId}`, profile, {
        ex: INTEREST_PROFILE_STALE_HOURS * 3600,
      });
    } catch {
      // Non-critical
    }
  }
}

export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
  const redis = getRedis();
  if (redis) {
    redis.del(`feed:profile:${userId}`).catch(() => {});
  }
}
```

### 1.6 Request Flow After Redis

```
GET /api/feed
     │
     ▼
[Redis: feed:cache:{userId}]
     │
   HIT (5-20ms) ──────────────────────────────► Return 20 posts
     │                                            (with realtime injection on page 1)
   MISS
     │
     ▼
[Postgres: feed_cache table]
     │
   HIT (50-100ms) ──► Write to Redis ──► Return 20 posts
     │
   MISS
     │
     ▼
[Full Pipeline: 200-500ms without Groq, 1-3s with Groq]
     │
     ▼
Write to Redis + Postgres ──► Return 20 posts
```

### 1.7 Redis Cost at Beta Scale

```
Operations per feed load:
  Cache hit:  1 GET                              = 1 command
  Cache miss: 1 GET (miss) + 1 SET (write back)  = 2 commands
  Profile:    1 GET (usually hit)                 = 1 command
  Total per request: 2-3 commands

At 1K DAU, 2 loads/day:
  2,000 requests × 2.5 avg commands = 5,000 commands/day = 150,000/month

Upstash free tier: 500,000 commands/month
Headroom: 3.3× → safe up to ~3K DAU before hitting free tier limit
```

---

## Part 2: Background Jobs via pg_cron

### Why Background Jobs

The feed pipeline depends on 4 tables that are currently empty or stale because nothing populates them:

```
Table                      What feeds into it                Effect when empty
─────────────────────────────────────────────────────────────────────────────────
post_features              compute_post_features() RPC       engagement_score = 0 (15% of ranking)
                                                             virality_velocity = 0 (10% of ranking)
                                                             content_quality = 0.5 (default)

user_interest_profiles     compute_user_interest_profile()   topic_overlap = 0 (10% of ranking)
                           RPC                               content_type_pref = 0.5 (default)
                                                             creator_affinity = 0

content_embeddings         topic extraction (Groq or         keyword_match = 0
                           keyword fallback)                 topic_overlap = 0

trending_topics            no computation exists yet         trending widget empty
```

**With these empty, 50% of the Tier 1 scoring formula is zeroed out.** The feed reduces to: freshness (10%) + following (20%) + fof (5%) = 35% of signal. That's barely better than chronological.

### 2.1 Enable pg_cron

Since you're self-hosting Postgres on EC2, you need to enable the pg_cron extension:

```sql
-- Run as superuser
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to the supabase user (or whatever role your app uses)
GRANT USAGE ON SCHEMA cron TO postgres;
```

In `postgresql.conf`, add:
```
shared_preload_libraries = 'pg_cron'
cron.database_name = 'your_database_name'
```

Restart Postgres after changing `postgresql.conf`.

### 2.2 Job 1: Refresh Post Features (every 15 minutes)

This calls the existing `compute_post_features()` RPC for recent posts.

```sql
-- Refresh engagement scores for posts from the last 3 days
SELECT cron.schedule(
  'refresh-post-features',
  '*/15 * * * *',
  $$
  DO $$
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
  END $$;
  $$
);
```

**What `compute_post_features()` does** (from `002_feed_rpc_functions.sql`):
- Counts likes, replies, shares for the post
- Computes `engagement_score` = weighted sum of interactions / age_hours
- Computes `virality_velocity` = interactions in last 2 hours / total interactions
- Computes `content_quality` heuristic based on length, media, engagement ratio
- Upserts into `post_features` table

**Cost:** ~200 function calls × ~5ms each = ~1 second of DB time every 15 min. Negligible.

### 2.3 Job 2: Refresh User Interest Profiles (every hour)

```sql
-- Recompute profiles for users active in the last 24 hours
SELECT cron.schedule(
  'refresh-interest-profiles',
  '0 * * * *',
  $$
  DO $$
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
  END $$;
  $$
);
```

**What `compute_user_interest_profile()` does** (from `002_feed_rpc_functions.sql`):
- Reads all `feed_events` for the user from the last 30 days
- Applies time-decay (7-day half-life) to each event
- Aggregates topic scores from `content_embeddings` joined with events
- Computes content type preferences (% of engagement per type)
- Identifies top 50 creator affinities
- Computes interaction patterns (avg dwell, session depth, peak hours)
- Upserts into `user_interest_profiles` table

**Cost:** ~500 users × ~50ms each = ~25 seconds of DB time per hour. Fine.

### 2.4 Job 3: Backfill Content Embeddings (every 30 minutes)

This uses the **existing keyword-based topic extractor** (no Groq needed, no API cost):

```sql
-- Extract topics for posts that don't have embeddings yet
SELECT cron.schedule(
  'backfill-content-embeddings',
  '*/30 * * * *',
  $$
  INSERT INTO content_embeddings (post_id, topics, keywords, sentiment_score, extracted_at)
  SELECT
    p.id,
    ARRAY[]::text[],   -- Will be filled by the API call
    ARRAY[]::text[],   -- Will be filled by the API call
    0,
    now()
  FROM posts p
  LEFT JOIN content_embeddings ce ON ce.post_id = p.id
  WHERE ce.post_id IS NULL
    AND p.deleted = false
    AND p.content IS NOT NULL
    AND p.content != ''
  LIMIT 50
  ON CONFLICT (post_id) DO NOTHING;
  $$
);
```

**BUT** — this only creates placeholder rows. The actual keyword extraction needs to happen in the application layer (it uses TypeScript logic in `topic-extractor.ts`). So we need a companion API endpoint. See Part 3.

### 2.5 Job 4: Clean Up Old Data (daily at 3 AM)

```sql
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

  -- Delete stale sessions
  DELETE FROM user_sessions WHERE last_active_at < now() - interval '7 days';
  $$
);
```

### 2.6 Job 5: Aggregate Daily Analytics (daily at 1 AM)

```sql
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

### 2.7 All pg_cron Jobs Summary

```
Job                        Schedule        What It Does                         DB Load
──────────────────────────────────────────────────────────────────────────────────────────
refresh-post-features      */15 * * * *    Recompute engagement scores          ~1s/run
refresh-interest-profiles  0 * * * *       Rebuild user taste profiles          ~25s/run
backfill-content-embeddings */30 * * * *   Create placeholder rows              <1s/run
cleanup-old-data           0 3 * * *       Prune events/sessions/cache >90d     ~5s/run
aggregate-daily-analytics  0 1 * * *       Aggregate yesterday's metrics        ~2s/run
```

Total daily DB load from cron: ~15 minutes of light work spread across 24 hours. Your t3.medium will not notice.

---

## Part 3: Keyword Extraction on Post Create

### Why On Create

Currently, the `content_embeddings` table is empty because topic extraction only happens if someone calls `POST /api/feed/extract-topics` manually. Level 2 fixes this by extracting keywords every time a post is created.

### 3.1 The Existing Keyword Extractor

`src/lib/feed/topic-extractor.ts` already has a **fallback keyword extractor** that requires no API calls:

```typescript
// Existing function (line ~80):
function fallbackTopicExtraction(content: string): { topics: string[]; keywords: string[]; sentiment: number }
```

It works by:
1. Tokenizing the post content
2. Removing stop words
3. Counting word frequencies
4. Matching against 8 hardcoded topic categories:
   - technology, ai, startups, design, career, funding, product, community
5. Returning top matched topics + top frequency keywords

**Cost: $0. Latency: <5ms. No API call.**

### 3.2 Where to Hook It In

Find the post creation handler. The exact location depends on your posts API, but the pattern is:

**In your post creation API route** (likely `src/app/api/posts/route.ts` or similar):

```typescript
// After the post is saved to the database:
import { extractAndStoreTopics } from '@/lib/feed/topic-extractor';

// Inside your POST handler, after inserting the post:
const { data: newPost } = await supabase.from('posts').insert({ ... }).select().single();

// Extract topics in the background (non-blocking)
if (newPost?.id && newPost?.content) {
  extractAndStoreTopics(newPost.id, newPost.content).catch((err) =>
    console.warn('[Feed] Topic extraction failed (non-critical):', err)
  );
}
```

### 3.3 New Function in `topic-extractor.ts`

Add this to the existing file:

```typescript
import { createAdminClient } from '@/utils/supabase-server';

/**
 * Extract topics/keywords from post content and store in content_embeddings.
 * Uses keyword fallback (no API cost). Groq extraction can be added later.
 */
export async function extractAndStoreTopics(postId: string, content: string): Promise<void> {
  const supabase = createAdminClient();

  // Use the existing fallback extractor (already in this file)
  const { topics, keywords, sentiment } = fallbackTopicExtraction(content);

  // Only store if we found something meaningful
  if (topics.length === 0 && keywords.length === 0) return;

  await supabase
    .from('content_embeddings')
    .upsert({
      post_id: postId,
      topics,
      keywords,
      sentiment_score: sentiment,
      extracted_at: new Date().toISOString(),
    }, { onConflict: 'post_id' });
}
```

### 3.4 Backfill Existing Posts

For posts already in the database that have no embeddings, create a one-time migration script:

**New file: `scripts/backfill-topics.ts`** (run once)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfill() {
  // Get all posts without embeddings
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content')
    .eq('deleted', false)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!posts) return;

  // Check which already have embeddings
  const { data: existing } = await supabase
    .from('content_embeddings')
    .select('post_id')
    .in('post_id', posts.map(p => p.id));

  const existingIds = new Set((existing || []).map(e => e.post_id));
  const toProcess = posts.filter(p => !existingIds.has(p.id) && p.content);

  console.log(`Processing ${toProcess.length} posts...`);

  for (const post of toProcess) {
    // Use the same keyword extraction logic
    // (import from topic-extractor or inline the logic)
    const { topics, keywords, sentiment } = extractTopics(post.content);

    if (topics.length > 0 || keywords.length > 0) {
      await supabase.from('content_embeddings').upsert({
        post_id: post.id,
        topics,
        keywords,
        sentiment_score: sentiment,
        extracted_at: new Date().toISOString(),
      }, { onConflict: 'post_id' });
    }
  }

  console.log('Backfill complete.');
}

backfill();
```

Run with: `npx tsx scripts/backfill-topics.ts`

---

## Part 4: Reliable Interaction Graph Updates

### The Problem

`src/app/api/feed/events/route.ts` currently calls `update_interaction_graph` as fire-and-forget on event flush. If it fails, the affinity scores between users never update, and `interaction_affinity` (15% of ranking) stays at 0.

### 4.1 What Needs to Change in `events/route.ts`

**Current code (simplified):**
```typescript
// Fire and forget — no error handling
supabase.rpc('update_interaction_graph', { p_user_id: userId, p_events: events });
```

**New code with retry:**
```typescript
// After batch_insert_feed_events succeeds:
const significantEvents = events.filter((e: { event_type: string }) =>
  ['like', 'reply', 'share', 'bookmark'].includes(e.event_type)
);

if (significantEvents.length > 0) {
  // Extract unique author_ids from significant events
  const authorIds = [...new Set(significantEvents.map((e: { author_id: string }) => e.author_id))];

  for (const authorId of authorIds) {
    const authorEvents = significantEvents.filter(
      (e: { author_id: string }) => e.author_id === authorId
    );

    // Retry up to 2 times
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await supabase.rpc('update_interaction_graph', {
        p_user_id: userId,
        p_target_user_id: authorId,
        p_event_count: authorEvents.length,
        p_event_weight: authorEvents.reduce(
          (sum: number, e: { event_type: string }) => sum + (EVENT_WEIGHTS[e.event_type] || 0),
          0
        ),
      });

      if (!error) break;
      if (attempt < 2) {
        console.warn(`[Feed] Interaction graph update failed (attempt ${attempt + 1}):`, error.message);
      }
    }
  }
}
```

**Note:** The exact RPC signature depends on what's in your `002_feed_rpc_functions.sql`. Check the actual `update_interaction_graph` function parameters and adjust.

---

## Part 5: Pipeline Observability

### 5.1 Structured Timing Logger

**New file: `src/lib/feed/pipeline-logger.ts`**

```typescript
export interface PipelineStageLog {
  stage: string;
  duration_ms: number;
  count?: number;
  source?: string;
  error?: string;
}

export class PipelineTimer {
  private stages: PipelineStageLog[] = [];
  private startTime: number;
  private currentStage: { name: string; start: number } | null = null;

  constructor(private userId: string) {
    this.startTime = Date.now();
  }

  start(stageName: string) {
    this.currentStage = { name: stageName, start: Date.now() };
  }

  end(extra?: { count?: number; source?: string; error?: string }) {
    if (!this.currentStage) return;
    this.stages.push({
      stage: this.currentStage.name,
      duration_ms: Date.now() - this.currentStage.start,
      ...extra,
    });
    this.currentStage = null;
  }

  finish(): { total_ms: number; stages: PipelineStageLog[]; userId: string } {
    return {
      userId: this.userId,
      total_ms: Date.now() - this.startTime,
      stages: this.stages,
    };
  }

  log() {
    const result = this.finish();
    const stageStr = result.stages
      .map((s) => `${s.stage}=${s.duration_ms}ms${s.count ? `(${s.count})` : ''}${s.error ? `[ERR]` : ''}`)
      .join(' → ');
    console.log(`[Feed Pipeline] user=${this.userId.substring(0, 8)} total=${result.total_ms}ms | ${stageStr}`);
    return result;
  }
}
```

### 5.2 Wire Into Pipeline

**Modify `src/lib/feed/pipeline.ts` `runFullPipeline`:**

```typescript
import { PipelineTimer } from './pipeline-logger';

async function runFullPipeline(
  userId: string,
  experiment: { experimentId: string; variant: string; config: Record<string, number> } | null
): Promise<ScoredPost[]> {
  const timer = new PipelineTimer(userId);

  // Stage 1: Candidates
  timer.start('candidates');
  const candidates = await generateCandidates(userId);
  timer.end({ count: candidates.length });

  if (candidates.length === 0) {
    timer.log();
    return [];
  }

  // Stage 2: Interest profile
  timer.start('profile');
  const userProfile = await getUserInterestProfile(userId);
  timer.end({ source: userProfile ? 'cached' : 'null' });

  // Stage 3: Feature extraction
  timer.start('features');
  const features = await extractFeatures(candidates, userId, userProfile);
  timer.end({ count: features.length });

  // Stage 4: Tier 1 scoring
  timer.start('tier1');
  const weightOverrides = experiment?.config;
  const tier1Scored = scorePostsDeterministic(features, weightOverrides);
  timer.end({ count: tier1Scored.length });

  // Stage 5: Tier 2 Groq (optional)
  timer.start('groq');
  const postSummaries = new Map(candidates.map((c) => [c.id, c.content || '']));
  const tier2Scored = await groqRerank(tier1Scored, userProfile, postSummaries);
  timer.end({ count: tier2Scored.length, source: process.env.GROQ_API_KEY ? 'groq' : 'skipped' });

  // Stage 6: Diversity
  timer.start('diversity');
  const finalScored = applyDiversityRules(tier2Scored, experiment?.config);
  timer.end({ count: finalScored.length });

  timer.log();
  // Output: [Feed Pipeline] user=abc12345 total=1423ms | candidates=312ms(187) → profile=5ms → features=156ms(187) → tier1=2ms(187) → groq=934ms(50) → diversity=1ms(187)

  return finalScored;
}
```

### 5.3 Add Timing to Cache Hits Too

**In the main `generatePersonalizedFeed` function**, log cache hits:

```typescript
if (cached) {
  console.log(`[Feed] Cache HIT for user=${userId.substring(0, 8)} source=redis posts=${cached.posts.length}`);
  // ... existing cache hit code
}
```

### 5.4 Example Log Output

```
# Cache hit (most requests):
[Feed] Cache HIT for user=abc12345 source=redis posts=20

# Full pipeline (20% of requests):
[Feed Pipeline] user=abc12345 total=1423ms | candidates=312ms(187) → profile=5ms → features=156ms(187) → tier1=2ms(187) → groq=934ms(50) → diversity=1ms(187)

# Pipeline without Groq:
[Feed Pipeline] user=abc12345 total=476ms | candidates=298ms(187) → profile=5ms → features=162ms(187) → tier1=2ms(187) → groq=0ms(skipped) → diversity=1ms(187)

# Pipeline failure (falls to chronological):
[Feed Pipeline] user=abc12345 total=15ms | candidates=15ms(0)
```

Now you can instantly see: where time is spent, what cache layer served the request, and when things fail.

---

## Part 6: Trending Topics (Vercel Cron or pg_cron)

### 6.1 Compute Trending Topics

The `trending_topics` table exists but is never populated. Add this as a pg_cron job:

```sql
SELECT cron.schedule(
  'compute-trending-topics',
  '*/30 * * * *',
  $$
  -- Compute trending topics from recent post engagement
  TRUNCATE trending_topics;

  INSERT INTO trending_topics (topic, score, post_count, computed_at)
  SELECT
    unnest(ce.topics) as topic,
    SUM(COALESCE(pf.engagement_score, 0) + 1) as score,
    COUNT(DISTINCT ce.post_id) as post_count,
    now() as computed_at
  FROM content_embeddings ce
  JOIN posts p ON p.id = ce.post_id
  LEFT JOIN post_features pf ON pf.post_id = ce.post_id
  WHERE p.created_at > now() - interval '24 hours'
    AND p.deleted = false
    AND ce.topics IS NOT NULL
    AND array_length(ce.topics, 1) > 0
  GROUP BY unnest(ce.topics)
  HAVING COUNT(DISTINCT ce.post_id) >= 2
  ORDER BY score DESC
  LIMIT 20;
  $$
);
```

### 6.2 Cache in Redis

After the pg_cron job runs, you can also write the trending data to Redis for the frontend widget. Add to the trending API route:

```typescript
// In GET /api/trending/route.ts
const redis = getRedis();
if (redis) {
  const cached = await redis.get('feed:trending');
  if (cached) return NextResponse.json(cached);
}

// ... fetch from DB ...

if (redis) {
  await redis.set('feed:trending', trendingData, { ex: 1800 }); // 30min TTL
}
```

---

## Part 7: Fix the Realtime Injector

### The Bug

`src/lib/feed/realtime-injector.ts` line 65 hardcodes `is_following: true` for all new posts:

```typescript
is_following: true, // Assume followed for now
```

This gives every injected post a free +0.20 score boost (the `following` weight).

### The Fix

```typescript
// Get the user's follow list once
const { data: follows } = await supabase
  .from('user_follows')
  .select('followee_id')
  .eq('follower_id', userId);

const followingIds = new Set((follows || []).map((f: { followee_id: string }) => f.followee_id));

// Then in the candidate mapping:
is_following: followingIds.has(p.author_id as string),
```

One extra query (~5ms) but the scoring accuracy is much better.

---

## Part 8: Environment Variables Summary

**Add these to your `.env`:**

```bash
# --- Required (you already have these) ---
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# --- Level 2 additions ---
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# --- Optional (Tier 2 LLM re-ranking) ---
GROQ_API_KEY=your-groq-key
```

---

## Part 9: Complete Request Lifecycle (Level 2)

```
═══════════════════════════════════════════════════════════════════
                    FEED REQUEST LIFECYCLE (LEVEL 2)
═══════════════════════════════════════════════════════════════════

USER OPENS FEED
      │
      ▼
GET /api/feed?cursor=...
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ AUTH CHECK                                                       │
│ supabase.auth.getUser()                                          │
│ If unauthorized → 401                                            │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CACHE LAYER 1: REDIS                                     ~5ms   │
│ GET feed:cache:{userId}                                          │
│                                                                  │
│ HIT? ──────────────────────────────────────────┐                 │
│                                                │                 │
│ MISS ──┐                                       │                 │
└────────┼───────────────────────────────────────┼─────────────────┘
         │                                       │
         ▼                                       │
┌─────────────────────────────────────┐          │
│ CACHE LAYER 2: POSTGRES     ~50ms  │          │
│ SELECT FROM feed_cache              │          │
│ WHERE expires_at > now()            │          │
│                                     │          │
│ HIT? → Write to Redis → ───────────┼──────────┤
│                                     │          │
│ MISS ──┐                            │          │
└────────┼────────────────────────────┘          │
         │                                       │
         ▼                                       │
┌─────────────────────────────────────────────────────────────────┐
│ FULL PIPELINE                                    ~500ms-3s      │
│                                                                  │
│ ┌─ Stage 1: Candidates ─────────────────── ~300ms ─────────────┐│
│ │ RPC: get_feed_candidates(userId, 200, 72hrs)                 ││
│ │ Fallback: query posts from followed users                    ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ ┌─ Stage 2: Interest Profile ──────────── ~5ms (Redis hit) ───┐│
│ │ Redis: GET feed:profile:{userId}                             ││
│ │ Fallback: Postgres → RPC recompute                           ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ ┌─ Stage 3: Feature Extraction ────────── ~150ms ─────────────┐│
│ │ Batch queries: post_features, content_embeddings,            ││
│ │                user_interaction_graph                         ││
│ │ Normalization: likes, replies, followers, affinity            ││
│ │ Freshness: e^(-age_hours / 24)                               ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ ┌─ Stage 4: Tier 1 Scoring ───────────── ~2ms ────────────────┐│
│ │ Weighted sum: engagement(0.15) + virality(0.10) + ...        ││
│ │ Sort descending                                              ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ ┌─ Stage 5: Tier 2 Groq (OPTIONAL) ───── ~1000ms ────────────┐│
│ │ If GROQ_API_KEY set: send top 50 → rerank → blend scores    ││
│ │ If not set: skip (Tier 1 order preserved)                    ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ ┌─ Stage 6: Diversity Rules ──────────── ~1ms ────────────────┐│
│ │ Author limit (2 per author in top 20)                        ││
│ │ Type variety (max 3 consecutive same type)                   ││
│ │ Freshness enforcement (30% of top 10 < 6hrs old)            ││
│ │ New creator boost (1.2× if follower_norm < 0.01)            ││
│ └──────────────────────────────────────────────────────────────┘│
│                         │                                        │
│ Write to Redis (SET with EX 7200) + Postgres                    │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ REALTIME INJECTION (page 1 only)                         ~50ms  │
│ Query posts created after cache.computed_at                      │
│ Quick-score with Tier 1 only                                    │
│ Inject at positions [0, 4, 9]                                   │
│ Check actual follow status (NOT hardcoded true)                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ POST HYDRATION                                           ~100ms │
│ Bulk SELECT from posts with author, media, polls                │
│ Parallel: likes count + replies count                           │
│ Order by feed ranking                                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
              Return JSON to client
              {
                posts: [...],
                cursor: "last-post-id",
                source: "cache" | "pipeline" | "chronological",
                _debug: "pipeline OK: source=cache, 20 posts"
              }


═══════════════════════════════════════════════════════════════════
                    BACKGROUND PROCESSES
═══════════════════════════════════════════════════════════════════

Every 15 min:   [pg_cron] → compute_post_features for recent posts
Every 30 min:   [pg_cron] → compute trending_topics
Every 1 hour:   [pg_cron] → compute_user_interest_profile for active users
Daily 1 AM:     [pg_cron] → aggregate feed_analytics_daily
Daily 3 AM:     [pg_cron] → cleanup old events, sessions, cache

On post create: [App code] → extractAndStoreTopics() → content_embeddings
On event flush: [App code] → update_interaction_graph() with retry


═══════════════════════════════════════════════════════════════════
                    EVENT TRACKING (unchanged)
═══════════════════════════════════════════════════════════════════

User scrolls/clicks/likes
      │
      ▼
FeedEventTracker (client-side buffer)
      │
      ├── Buffer reaches 20 events → flush
      ├── 10 seconds pass → flush
      ├── Tab becomes hidden → flush (sendBeacon)
      └── Page unload → flush (sendBeacon)
      │
      ▼
POST /api/feed/events
      │
      ├── batch_insert_feed_events (RPC)
      │     ├── feed_events table
      │     ├── feed_seen_posts (on impression)
      │     └── user_sessions update
      │
      └── update_interaction_graph (with retry)
            └── user_interaction_graph table
```

---

## Part 10: Implementation Checklist

```
Day 1 (Foundation):
  □ Create Upstash Redis account, get URL + token
  □ Add env vars to .env
  □ Create src/lib/feed/redis.ts
  □ Rewrite cache-manager.ts (Redis + Postgres dual-write)
  □ Rewrite interest-profile.ts (3-layer cache)
  □ Test: feed loads, Redis keys appear in Upstash dashboard

Day 2 (Background Jobs):
  □ Enable pg_cron extension in Postgres
  □ Create all 5 cron jobs (post_features, profiles, embeddings, cleanup, analytics)
  □ Run backfill script for existing content_embeddings
  □ Verify: post_features table has rows, interest_profiles populated
  □ Verify: pg_cron job history shows successful runs

Day 3 (Integration):
  □ Add extractAndStoreTopics() call in post creation handler
  □ Fix realtime-injector.ts is_following bug
  □ Add retry logic to interaction graph updates in events/route.ts
  □ Create src/lib/feed/pipeline-logger.ts
  □ Wire PipelineTimer into pipeline.ts
  □ Test: create a post → check content_embeddings → load feed → check logs

Day 4 (Trending + Polish):
  □ Add trending topics pg_cron job
  □ Add Redis caching to trending API route
  □ Test full flow: create posts, interact, wait for cron, check feed ordering
  □ Verify pipeline logs show per-stage timing
  □ Load test: hit /api/feed 50 times, check p50 and p99 latency

Day 5 (Validation):
  □ Check Upstash dashboard: command count within free tier limits
  □ Check pg_cron: all jobs running, no failures
  □ Check feed response: source="cache" (not "chronological")
  □ Check _debug field: confirms pipeline ran
  □ Check post_features: engagement_score > 0 for popular posts
  □ Check content_embeddings: topics populated for recent posts
  □ Run the A/B experiment setup (personalized vs chronological)
```

---

## Part 11: Cost Breakdown (Level 2 Final)

### Development Environment (EC2 t3.medium, Postgres co-located)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| AWS EC2 t3.medium | $30 | Supabase + Postgres on same box |
| EBS storage (20GB gp3) | ~$2 | |
| Upstash Redis | $0 | Free tier: 500K commands/mo |
| Groq API (optional) | $0–0.30 | Only if GROQ_API_KEY set |
| pg_cron | $0 | Postgres extension |
| **Total** | **~$32** | |

### Production (EC2 + RDS)

| Item | Monthly Cost | Notes |
|------|-------------|-------|
| AWS EC2 t3.medium | $30 | Supabase app server |
| AWS RDS db.t3.medium | $65 | PostgreSQL, single-AZ, 20GB gp3 |
| EBS + data transfer | ~$5 | |
| Upstash Redis | $0 | Free tier covers up to ~3K DAU |
| Groq API (optional) | $0–13 | $0.0011/call × cache miss rate |
| pg_cron | $0 | Postgres extension |
| **Total** | **~$100** | Same as before — Level 2 adds $0 on infra |

### At Scale (when you outgrow free tiers)

| DAU | Redis Cost | Groq Cost | Total Added |
|-----|-----------|-----------|-------------|
| 1K | $0 | $0.30 | $0.30 |
| 3K | $0 | $1 | $1 |
| 5K | ~$2 (pay-as-you-go) | $2 | $4 |
| 10K | ~$5 | $13 | $18 |

---

## Part 12: Expected Performance (Level 2)

### Latency Distribution

```
Request type          % of traffic    Latency (p50)    Latency (p99)
─────────────────────────────────────────────────────────────────────
Redis cache hit       ~70%            8ms              20ms
Postgres cache hit    ~10%            60ms             120ms
Full pipeline (no Groq) ~15%         350ms            600ms
Full pipeline (w/ Groq) ~5%          1200ms           2500ms
Chronological fallback  <1%          50ms             100ms
```

### Weighted Average

```
p50 = 0.70×8 + 0.10×60 + 0.15×350 + 0.05×1200
    = 5.6 + 6 + 52.5 + 60
    = ~124ms

p50 without Groq = 0.80×8 + 0.10×60 + 0.10×350
                 = 6.4 + 6 + 35
                 = ~47ms
```

**Without Groq, median feed load is under 50ms.** That's fast enough that users perceive it as instant.

---

## What Comes Next (Level 3 Teaser)

Level 2 gets the infrastructure right. Level 3 makes the ranking smarter:

```
Level 2 topic matching:   "startup" in post keywords matches "startup" in user interests
                          ↳ Binary match. "seed round fundraising" does NOT match "startup".

Level 3 topic matching:   cosine_similarity(post_vector, user_vector) = 0.87
                          ↳ "seed round fundraising" DOES match "startup" (semantic similarity)
```

But you don't need Level 3 until you have enough content diversity that keyword matching fails. At <10K posts, keywords cover 80%+ of matches.
