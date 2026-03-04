import { createAdminClient } from '@/utils/supabase-server';
import { extractFeatures } from './feature-extractor';
import { quickScore } from './scorer';
import { getUserInterestProfile } from './interest-profile';
import { REALTIME_INJECTION_POSITIONS } from './constants';
import type { RawCandidate } from './candidate-generator';

/**
 * Fetch posts created after the cache computation time and inject them
 * into the cached feed at strategic positions.
 */
export async function injectRealtimePosts(
  userId: string,
  cachedPosts: string[],
  cachedScores: number[],
  cacheComputedAt: string
): Promise<{ postIds: string[]; scores: number[] }> {
  const supabase = createAdminClient();

  // Fetch new posts since cache was computed
  const { data: newPosts } = await supabase
    .from('posts')
    .select(`
      id, author_id, environment_id, content, post_type, created_at,
      author:author_id(id, username, full_name, avatar_url, is_verified)
    `)
    .eq('deleted', false)
    .is('parent_post_id', null)
    .gt('created_at', cacheComputedAt)
    .neq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!newPosts || newPosts.length === 0) {
    return { postIds: cachedPosts, scores: cachedScores };
  }

  // Filter out posts already in cache
  const cachedSet = new Set(cachedPosts);
  const freshPosts = newPosts.filter((p: { id: string }) => !cachedSet.has(p.id));

  if (freshPosts.length === 0) {
    return { postIds: cachedPosts, scores: cachedScores };
  }

  // Get the user's follow list to correctly set is_following
  const { data: follows } = await supabase
    .from('user_follows')
    .select('followee_id')
    .eq('follower_id', userId);

  const followingIds = new Set((follows || []).map((f: { followee_id: string }) => f.followee_id));

  // Quick-score the new posts
  const candidates: RawCandidate[] = freshPosts.map((p: Record<string, unknown>) => {
    const author = p.author as Record<string, unknown> | null;
    return {
      id: p.id as string,
      author_id: p.author_id as string,
      environment_id: p.environment_id as string,
      content: p.content as string | null,
      post_type: p.post_type as string,
      created_at: p.created_at as string,
      likes_count: 0,
      replies_count: 0,
      has_media: false,
      has_poll: (p.post_type as string) === 'poll',
      author_username: (author?.username as string) || '',
      author_full_name: (author?.full_name as string) || '',
      author_avatar_url: (author?.avatar_url as string) || null,
      author_is_verified: Boolean(author?.is_verified),
      author_follower_count: 0,
      is_following: followingIds.has(p.author_id as string),
      is_fof: false,
    };
  });

  const userProfile = await getUserInterestProfile(userId);
  const features = await extractFeatures(candidates, userId, userProfile);
  const scored = quickScore(features);

  // Inject at strategic positions
  const resultPostIds = [...cachedPosts];
  const resultScores = [...cachedScores];

  const toInject = scored.slice(0, REALTIME_INJECTION_POSITIONS.length);
  for (let i = 0; i < toInject.length; i++) {
    const position = Math.min(REALTIME_INJECTION_POSITIONS[i], resultPostIds.length);
    resultPostIds.splice(position, 0, toInject[i].post_id);
    resultScores.splice(position, 0, toInject[i].score);
  }

  return { postIds: resultPostIds, scores: resultScores };
}
