import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const CACHE_PREFIX = 'recommendations';
const CACHE_TTL = 120; // 2 minutes

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userLimit = Math.min(Math.max(parseInt(searchParams.get('limit') || '8', 10) || 8, 1), 50);

    // Use x-user-id header for reads — avoids getUser() network call
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createAuthClient();

    // Check cache (per-user because recommendations are personalized)
    const cacheKey = `${CACHE_PREFIX}:${userId}:limit=${userLimit}`;
    const cached = cacheGet<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT' },
      });
    }

    // Run all queries in parallel
    const [suggestedUsers, trendingPosts, recommendedJobs, recommendedGigs] = await Promise.all([
      // Suggested users: users the current user doesn't follow
      (async () => {
        const { data: followRows } = await supabase
          .from('user_follows')
          .select('followee_id')
          .eq('follower_id', userId);

        const followingIds = new Set((followRows || []).map((r: { followee_id: string }) => r.followee_id));
        followingIds.add(userId); // exclude self

        const fetchLimit = Math.max(userLimit * 3, 40);
        const { data: users } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url, tagline, is_verified')
          .eq('account_status', 'active')
          .order('is_verified', { ascending: false })
          .limit(fetchLimit);

        if (!users) return [];

        return users
          .filter((u: { id: string }) => !followingIds.has(u.id))
          .slice(0, userLimit);
      })(),

      // Trending posts: top 5 by engagement score from the last 14 days
      (async () => {
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const { data: recentPosts } = await supabase
          .from('posts')
          .select('id, content, created_at, author_id')
          .eq('deleted', false)
          .is('parent_post_id', null)
          .neq('author_id', userId)
          .gte('created_at', fourteenDaysAgo.toISOString())
          .order('created_at', { ascending: false })
          .limit(50);

        if (!recentPosts || recentPosts.length === 0) return [];

        const postIds = recentPosts.map((p: { id: string }) => p.id);
        const authorIds = [...new Set(recentPosts.map((p: { author_id: string }) => p.author_id))];

        // Batch fetch likes, replies, media, and author info
        const [likesRes, repliesRes, mediaRes, authorsRes] = await Promise.all([
          supabase.from('post_likes').select('post_id').in('post_id', postIds),
          supabase.from('posts').select('parent_post_id').in('parent_post_id', postIds).eq('deleted', false),
          supabase.from('post_media').select('post_id').in('post_id', postIds),
          supabase.from('users').select('id, username, full_name, avatar_url').in('id', authorIds).eq('account_status', 'active'),
        ]);

        const likesMap = new Map<string, number>();
        likesRes.data?.forEach((l: { post_id: string }) => {
          likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1);
        });

        const repliesMap = new Map<string, number>();
        repliesRes.data?.forEach((r: { parent_post_id: string }) => {
          repliesMap.set(r.parent_post_id, (repliesMap.get(r.parent_post_id) || 0) + 1);
        });

        const mediaMap = new Map<string, number>();
        mediaRes.data?.forEach((m: { post_id: string }) => {
          mediaMap.set(m.post_id, (mediaMap.get(m.post_id) || 0) + 1);
        });

        const authorsMap = new Map<string, { username: string; full_name: string; avatar_url: string | null }>();
        authorsRes.data?.forEach((a: { id: string; username: string; full_name: string; avatar_url: string | null }) => {
          authorsMap.set(a.id, { username: a.username, full_name: a.full_name, avatar_url: a.avatar_url });
        });

        const now = Date.now();

        // Calculate engagement score and sort
        return recentPosts
          .filter((p: { author_id: string }) => authorsMap.has(p.author_id))
          .map((p: { id: string; content: string; created_at: string; author_id: string }) => {
            const likes = likesMap.get(p.id) || 0;
            const replies = repliesMap.get(p.id) || 0;
            const mediaCount = Math.min(mediaMap.get(p.id) || 0, 3);
            const ageMs = now - new Date(p.created_at).getTime();
            const ageHours = ageMs / (1000 * 60 * 60);

            // Recency multiplier
            const recencyMultiplier = ageHours <= 24 ? 1.5 : ageHours <= 48 ? 1.2 : 1.0;

            // Velocity: likes per hour (avoid division by zero)
            const velocityBonus = ageHours > 0 ? (likes / ageHours) * 10 : 0;

            const score = ((likes * 3) + (replies * 5) + (mediaCount * 2) + velocityBonus) * recencyMultiplier;

            return {
              id: p.id,
              content: p.content,
              created_at: p.created_at,
              likes,
              replies,
              engagement_score: Math.round(score * 10) / 10,
              author: authorsMap.get(p.author_id) || { username: 'unknown', full_name: 'Unknown', avatar_url: null },
            };
          })
          .sort((a, b) => b.engagement_score - a.engagement_score)
          .slice(0, 5);
      })(),
      // Recommended jobs: latest active jobs
      (async () => {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, company, location, salary_range, job_type, deadline')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        return jobs || [];
      })(),

      // Recommended gigs: latest active gigs
      (async () => {
        const { data: gigs } = await supabase
          .from('gigs')
          .select('id, title, description, budget, duration, skills_required, deadline')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(8);

        return gigs || [];
      })(),
    ]);

    const result = { suggestedUsers, trendingPosts, recommendedJobs, recommendedGigs };
    cacheSet(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error in recommendations API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
