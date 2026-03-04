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
  // Layer 1: Redis (~5-20ms)
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get<RedisFeedCache>(`feed:cache:${userId}`);
      if (cached && cached.post_ids && cached.post_ids.length > 0) {
        const { pagePostIds, pageScores, hasMore } = paginateCache(
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
            expires_at: '',
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

  // Layer 2: Postgres (~50-150ms)
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
): { pagePostIds: string[]; pageScores: number[]; hasMore: boolean } {
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

  return { pagePostIds, pageScores, hasMore };
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

  // Write to Postgres (durable backup)
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
