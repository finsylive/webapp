import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedCacheEntry, ScoredPost } from './types';
import { CACHE_TTL_HOURS, FEED_PAGE_SIZE } from './constants';

/**
 * Get cached feed for a user. Returns null if no valid cache exists.
 */
export async function getCachedFeed(
  supabase: SupabaseClient,
  userId: string,
  cursor?: string
): Promise<{ posts: string[]; scores: number[]; hasMore: boolean; entry: FeedCacheEntry } | null> {
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
  const allPostIds = entry.post_ids;

  // Skip empty cached feeds — they were written by mistake
  if (!allPostIds || allPostIds.length === 0) return null;
  const allScores = entry.scores;

  // Cursor-based pagination
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

  return {
    posts: pagePostIds,
    scores: pageScores,
    hasMore,
    entry,
  };
}

/**
 * Write a ranked feed to cache with TTL.
 */
export async function writeFeedCache(
  supabase: SupabaseClient,
  userId: string,
  scoredPosts: ScoredPost[],
  experimentId?: string | null,
  variant?: string | null
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);

  const postIds = scoredPosts.map((s) => s.post_id);
  const scores = scoredPosts.map((s) => s.score);

  // Delete old caches for this user
  await supabase.from('feed_cache').delete().eq('user_id', userId);

  // Insert new cache
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
 * Invalidate feed cache for a user (e.g. on forced refresh).
 */
export async function invalidateFeedCache(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.from('feed_cache').delete().eq('user_id', userId);
}
