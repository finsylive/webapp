import type { SupabaseClient } from '@supabase/supabase-js';
import { CANDIDATE_POOL_SIZE } from './constants';

export interface RawCandidate {
  id: string;
  author_id: string;
  environment_id: string;
  content: string | null;
  post_type: string;
  created_at: string;
  likes_count: number;
  replies_count: number;
  has_media: boolean;
  has_poll: boolean;
  author_username: string;
  author_full_name: string;
  author_avatar_url: string | null;
  author_is_verified: boolean;
  author_follower_count: number;
  is_following: boolean;
  is_fof: boolean;
}

/**
 * Generate candidate posts for the ranking pipeline via RPC.
 * Falls back to a simple query if RPC is unavailable.
 */
export async function generateCandidates(
  supabase: SupabaseClient,
  userId: string,
  limit: number = CANDIDATE_POOL_SIZE,
  maxAgeHours: number = 72
): Promise<RawCandidate[]> {
  try {
    // Try RPC first
    const { data, error } = await supabase.rpc('get_feed_candidates', {
      p_user_id: userId,
      p_limit: limit,
      p_max_age_hours: maxAgeHours,
    });

    if (!error && data && data.length > 0) {
      console.log(`[Feed] RPC returned ${data.length} candidates`);
      return data as RawCandidate[];
    }

    if (error) {
      console.warn('[Feed] get_feed_candidates RPC failed:', error.message);
    } else {
      console.log('[Feed] RPC returned 0 candidates, trying fallback');
    }
  } catch (err) {
    console.warn('[Feed] Candidate generation RPC error:', err);
  }

  // Fallback: simple query (no time cutoff — we want results even if posts are old)
  const candidates = await fallbackCandidateQuery(supabase, userId, limit);
  console.log(`[Feed] Fallback returned ${candidates.length} candidates`);
  return candidates;
}

async function fallbackCandidateQuery(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<RawCandidate[]> {
  // Get who the user follows
  const { data: follows } = await supabase
    .from('user_follows')
    .select('followee_id')
    .eq('follower_id', userId);

  const followingIds = (follows || []).map((f: { followee_id: string }) => f.followee_id);

  // Get seen post IDs
  const { data: seen } = await supabase
    .from('feed_seen_posts')
    .select('post_id')
    .eq('user_id', userId);

  const seenIds = new Set((seen || []).map((s: { post_id: string }) => s.post_id));

  // Get recent posts — no time cutoff so we always return results
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(`
      id, author_id, environment_id, content, post_type, created_at,
      author:author_id!inner(id, username, full_name, avatar_url, is_verified, account_status)
    `)
    .eq('deleted', false)
    .is('parent_post_id', null)
    .neq('author_id', userId)
    .eq('author.account_status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit * 2);

  if (postsError) {
    console.warn('[Feed] Fallback posts query failed:', postsError.message);
  }

  if (!posts) return [];

  // Get likes counts
  const postIds = posts.map((p: { id: string }) => p.id);
  const { data: likes } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);

  const likesMap = new Map<string, number>();
  (likes || []).forEach((l: { post_id: string }) => {
    likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1);
  });

  return posts
    .filter((p: { id: string }) => !seenIds.has(p.id))
    .slice(0, limit)
    .map((p: Record<string, unknown>) => {
      const author = p.author as Record<string, unknown> | null;
      return {
        id: p.id as string,
        author_id: p.author_id as string,
        environment_id: p.environment_id as string,
        content: p.content as string | null,
        post_type: p.post_type as string,
        created_at: p.created_at as string,
        likes_count: likesMap.get(p.id as string) || 0,
        replies_count: 0,
        has_media: false,
        has_poll: (p.post_type as string) === 'poll',
        author_username: (author?.username as string) || '',
        author_full_name: (author?.full_name as string) || '',
        author_avatar_url: (author?.avatar_url as string) || null,
        author_is_verified: Boolean(author?.is_verified),
        author_follower_count: 0,
        is_following: followingIds.includes(p.author_id as string),
        is_fof: false,
      };
    });
}
