import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { generatePersonalizedFeed } from '@/lib/feed/pipeline';
import { FEED_PAGE_SIZE } from '@/lib/feed/constants';
import { normalizePostPoll } from '@/api/posts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Use x-user-id header for fast auth check, createAuthClient for RLS queries
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = await createAuthClient();

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get('cursor') || undefined;
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // If offset > 0 with no cursor, we're continuing chronological pagination
    // (ranked posts have been exhausted, now serving chronological)
    if (offset > 0 && !cursor) {
      return await serveChronological(supabase, userId, offset);
    }

    // Try personalized feed pipeline
    let postIds: string[] = [];
    let feedSource = 'fallback';
    let hasMore = false;
    let feedCursor: string | undefined;
    let experimentId: string | null = null;
    let variant: string | null = null;

    let pipelineDebug: string | undefined;
    try {
      const feedResponse = await generatePersonalizedFeed(supabase, userId, cursor);
      postIds = feedResponse.posts.map((p) => p.post_id);
      feedSource = feedResponse.source;
      hasMore = feedResponse.has_more;
      feedCursor = feedResponse.cursor;
      experimentId = feedResponse.experiment_id ?? null;
      variant = feedResponse.variant ?? null;
      if (postIds.length === 0) {
        pipelineDebug = `pipeline returned source="${feedResponse.source}" with 0 posts`;
      } else {
        pipelineDebug = `pipeline OK: source="${feedResponse.source}", ${postIds.length} posts`;
      }
    } catch (pipelineError) {
      pipelineDebug = `pipeline threw: ${pipelineError instanceof Error ? pipelineError.message : String(pipelineError)}`;
      console.warn('Feed pipeline failed:', pipelineError);
    }

    // Fallback: chronological feed if pipeline returns no posts
    if (postIds.length === 0) {
      return await serveChronological(supabase, userId, offset);
    }

    // Hydrate ranked posts with full data
    const { data: fullPosts } = await supabase
      .from('posts')
      .select(`
        *,
        author:author_id(id, username, avatar_url, full_name, is_verified, account_status),
        environment:environment_id(id, name, description, picture),
        media:post_media(*),
        poll:post_polls(*, options:post_poll_options(*))
      `)
      .in('id', postIds)
      .eq('deleted', false);

    if (!fullPosts) {
      return NextResponse.json({
        posts: [],
        cursor: null,
        has_more: false,
        source: 'fallback',
      });
    }

    // Filter out posts from deactivated/deleted/suspended users
    const activePosts = fullPosts.filter((p: Record<string, unknown>) => {
      const author = p.author as Record<string, unknown> | null;
      return !author || !author.account_status || author.account_status === 'active';
    });

    // Get like and reply counts in batch (2 queries total instead of N+1)
    const activePostIds = activePosts.map((p: Record<string, unknown>) => p.id as string);
    const [likesRows, repliesRows] = await Promise.all([
      supabase
        .from('post_likes')
        .select('post_id')
        .in('post_id', activePostIds),
      supabase
        .from('posts')
        .select('parent_post_id')
        .in('parent_post_id', activePostIds)
        .eq('deleted', false),
    ]);

    const likesMap = new Map<string, number>();
    (likesRows.data || []).forEach((r: { post_id: string }) => {
      likesMap.set(r.post_id, (likesMap.get(r.post_id) || 0) + 1);
    });

    const repliesMap = new Map<string, number>();
    (repliesRows.data || []).forEach((r: { parent_post_id: string }) => {
      repliesMap.set(r.parent_post_id, (repliesMap.get(r.parent_post_id) || 0) + 1);
    });

    // Build post map for ordering
    const postMap = new Map(
      activePosts.map((p: Record<string, unknown>) => [
        p.id as string,
        normalizePostPoll({
          ...p,
          likes: likesMap.get(p.id as string) || 0,
          replies: repliesMap.get(p.id as string) || 0,
        }),
      ])
    );

    // Order posts by feed ranking
    const orderedPosts = activePostIds
      .map((id) => postMap.get(id))
      .filter(Boolean);

    // Always signal more posts available — when ranked posts run out,
    // the next request falls through to chronological seamlessly
    const response = NextResponse.json({
      posts: orderedPosts,
      cursor: feedCursor,
      offset: 0,
      has_more: hasMore || orderedPosts.length > 0,
      source: feedSource,
      experiment_id: experimentId,
      variant: variant,
      _debug: pipelineDebug,
    });
    // Allow browser to serve stale cache for 30s while revalidating in background
    response.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    return response;
  } catch (error) {
    console.error('Error in feed API:', error);
    return NextResponse.json({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/**
 * Serve chronological feed, excluding any posts already shown from the ranked feed cache.
 */
async function serveChronological(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  userId: string,
  offset: number
) {
  // Get ranked post IDs to exclude (avoid duplicates with AI-ranked feed)
  let excludePostIds: string[] = [];
  try {
    const { data: cacheEntry } = await supabase
      .from('feed_cache')
      .select('post_ids')
      .eq('user_id', userId)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();
    if (cacheEntry?.post_ids) {
      excludePostIds = cacheEntry.post_ids as string[];
    }
  } catch {
    // Non-critical — just means we might show some duplicates
  }

  let query = supabase
    .from('posts')
    .select(`
      *,
      author:author_id(id, username, avatar_url, full_name, is_verified, account_status),
      environment:environment_id(id, name, description, picture),
      media:post_media(*),
      poll:post_polls(*, options:post_poll_options(*))
    `)
    .eq('deleted', false)
    .is('parent_post_id', null);

  // Exclude already-shown ranked posts
  if (excludePostIds.length > 0) {
    query = query.not('id', 'in', `(${excludePostIds.join(',')})`);
  }

  const { data: chronoPosts, error: chronoError } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + FEED_PAGE_SIZE - 1);

  console.log(`[Feed] Chronological query: offset=${offset}, returned=${chronoPosts?.length ?? 0}, error=${chronoError?.message ?? 'none'}, excluded=${excludePostIds.length}`);

  if (chronoError || !chronoPosts) {
    console.error('Chronological query failed:', chronoError);
    return NextResponse.json({
      posts: [],
      cursor: null,
      has_more: false,
      source: 'chronological',
    });
  }

  // Get like and reply counts in batch (2 queries instead of N+1)
  const chronoIds = chronoPosts.map((p: { id: string }) => p.id);
  const [likesRows, repliesRows] = await Promise.all([
    supabase
      .from('post_likes')
      .select('post_id')
      .in('post_id', chronoIds),
    supabase
      .from('posts')
      .select('parent_post_id')
      .in('parent_post_id', chronoIds)
      .eq('deleted', false),
  ]);

  const likesMap = new Map<string, number>();
  (likesRows.data || []).forEach((r: { post_id: string }) => {
    likesMap.set(r.post_id, (likesMap.get(r.post_id) || 0) + 1);
  });
  const repliesMap = new Map<string, number>();
  (repliesRows.data || []).forEach((r: { parent_post_id: string }) => {
    repliesMap.set(r.parent_post_id, (repliesMap.get(r.parent_post_id) || 0) + 1);
  });

  // Filter out posts from deactivated/deleted/suspended users
  const activeChronoPosts = chronoPosts.filter((p: Record<string, unknown>) => {
    const author = p.author as Record<string, unknown> | null;
    return !author || !author.account_status || author.account_status === 'active';
  });

  const postsWithCounts = activeChronoPosts.map((p: Record<string, unknown>) => normalizePostPoll({
    ...p,
    likes: likesMap.get(p.id as string) || 0,
    replies: repliesMap.get(p.id as string) || 0,
  }));

  return NextResponse.json({
    posts: postsWithCounts,
    cursor: null,
    offset: offset + postsWithCounts.length,
    has_more: chronoPosts.length === FEED_PAGE_SIZE,
    source: 'chronological',
    experiment_id: null,
    variant: null,
  });
}
