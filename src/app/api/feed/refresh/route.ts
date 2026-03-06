import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import { generatePersonalizedFeed } from '@/lib/feed/pipeline';
import { invalidateFeedCache } from '@/lib/feed/cache-manager';
import { invalidateProfileCache } from '@/lib/feed/interest-profile';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Invalidate caches
    await invalidateFeedCache(supabase, user.id);
    invalidateProfileCache(user.id);

    // Force recomputation
    const feedResponse = await generatePersonalizedFeed(supabase, user.id, undefined, true);

    return NextResponse.json({
      ok: true,
      source: feedResponse.source,
      post_count: feedResponse.posts.length,
    });
  } catch (error) {
    console.error('Error in feed refresh API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
