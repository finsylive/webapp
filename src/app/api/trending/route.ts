import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { cacheGet, cacheSet } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const CACHE_PREFIX = 'trending';
const CACHE_TTL = 60; // seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '5', 10) || 5, 1), 50);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check cache (shared across all authenticated users — trending is not personalized)
    const cacheKey = `${CACHE_PREFIX}:limit=${limit}&offset=${offset}`;
    const cached = cacheGet<{ posts: unknown[]; hasMore: boolean }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      });
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // Reduced from 500 → 200 for performance
    const { data: recentPosts } = await supabase
      .from('posts')
      .select('id, content, created_at, author_id, post_type')
      .eq('deleted', false)
      .is('parent_post_id', null)
      .gte('created_at', fourteenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (!recentPosts || recentPosts.length === 0) {
      const result = { posts: [], hasMore: false };
      cacheSet(cacheKey, result, CACHE_TTL);
      return NextResponse.json(result);
    }

    const postIds = recentPosts.map((p: { id: string }) => p.id);
    const authorIds = [...new Set(recentPosts.map((p: { author_id: string }) => p.author_id))];

    // Batch fetch likes, replies, media, author info, and admin overrides
    const [likesRes, repliesRes, mediaRes, authorsRes, overridesRes] = await Promise.all([
      supabase.from('post_likes').select('post_id').in('post_id', postIds),
      supabase.from('posts').select('parent_post_id').in('parent_post_id', postIds).eq('deleted', false),
      supabase.from('post_media').select('post_id, media_url, media_type, media_thumbnail, width, height').in('post_id', postIds),
      supabase.from('users').select('id, username, full_name, avatar_url, is_verified').in('id', authorIds),
      supabase.from('trending_overrides').select('post_id, status'),
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
    const mediaDetailMap = new Map<string, Array<{ media_url: string; media_type: string; media_thumbnail: string | null; width: number | null; height: number | null }>>();
    mediaRes.data?.forEach((m: { post_id: string; media_url: string; media_type: string; media_thumbnail: string | null; width: number | null; height: number | null }) => {
      mediaMap.set(m.post_id, (mediaMap.get(m.post_id) || 0) + 1);
      if (!mediaDetailMap.has(m.post_id)) mediaDetailMap.set(m.post_id, []);
      mediaDetailMap.get(m.post_id)!.push({ media_url: m.media_url, media_type: m.media_type, media_thumbnail: m.media_thumbnail, width: m.width, height: m.height });
    });

    const authorsMap = new Map<string, { id: string; username: string; full_name: string; avatar_url: string | null; is_verified: boolean }>();
    authorsRes.data?.forEach((a: { id: string; username: string; full_name: string; avatar_url: string | null; is_verified: boolean }) => {
      authorsMap.set(a.id, a);
    });

    // Process admin overrides
    const overridesMap = new Map<string, string>();
    overridesRes.data?.forEach((o: { post_id: string; status: string }) => {
      overridesMap.set(o.post_id, o.status);
    });

    const now = Date.now();

    // Calculate engagement score for all posts
    const scoredPosts = recentPosts
      .filter((p: { id: string }) => overridesMap.get(p.id) !== 'removed')
      .map((p: { id: string; content: string | null; created_at: string; author_id: string; post_type: string }) => {
        const likes = likesMap.get(p.id) || 0;
        const replies = repliesMap.get(p.id) || 0;
        const mediaCount = Math.min(mediaMap.get(p.id) || 0, 3);
        const ageMs = now - new Date(p.created_at).getTime();
        const ageHours = ageMs / (1000 * 60 * 60);

        const recencyMultiplier = ageHours <= 24 ? 1.5 : ageHours <= 48 ? 1.2 : 1.0;
        const velocityBonus = ageHours > 0 ? (likes / ageHours) * 10 : 0;
        const score = ((likes * 3) + (replies * 5) + (mediaCount * 2) + velocityBonus) * recencyMultiplier;

        const isPinned = overridesMap.get(p.id) === 'pinned';

        const author = authorsMap.get(p.author_id) || { id: p.author_id, username: 'unknown', full_name: 'Unknown', avatar_url: null, is_verified: false };

        return {
          id: p.id,
          content: p.content,
          post_type: p.post_type,
          created_at: p.created_at,
          author_id: p.author_id,
          deleted: false,
          environment_id: '',
          parent_post_id: null,
          likes,
          replies,
          engagement_score: Math.round(score * 10) / 10,
          pinned: isPinned,
          author: {
            id: author.id,
            username: author.username,
            full_name: author.full_name,
            avatar_url: author.avatar_url,
            is_verified: author.is_verified,
          },
          media: (mediaDetailMap.get(p.id) || []).map((m, i) => ({
            id: `${p.id}-media-${i}`,
            post_id: p.id,
            media_url: m.media_url,
            media_type: m.media_type as 'video' | 'photo',
            created_at: p.created_at,
            media_thumbnail: m.media_thumbnail,
            width: m.width,
            height: m.height,
          })),
        };
      });

    // Pinned posts always come first, then sort by engagement score
    scoredPosts.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.engagement_score - a.engagement_score;
    });

    const paginated = scoredPosts.slice(offset, offset + limit);
    const hasMore = offset + limit < scoredPosts.length;

    const result = { posts: paginated, hasMore };
    cacheSet(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Error in trending API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
