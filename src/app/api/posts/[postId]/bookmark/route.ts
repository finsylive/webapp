import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/posts/[postId]/bookmark — bookmark a post
export async function POST(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('post_bookmarks')
      .upsert({ user_id: user.id, post_id: postId }, { onConflict: 'user_id,post_id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookmarked: true });
  } catch (error) {
    console.error('Error bookmarking post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/posts/[postId]/bookmark — unbookmark a post
export async function DELETE(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('post_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookmarked: false });
  } catch (error) {
    console.error('Error unbookmarking post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/posts/[postId]/bookmark — check if bookmarked
export async function GET(_request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ bookmarked: false });
    }

    const { data } = await supabase
      .from('post_bookmarks')
      .select('id')
      .eq('user_id', user.id)
      .eq('post_id', postId)
      .maybeSingle();

    return NextResponse.json({ bookmarked: !!data });
  } catch (error) {
    console.error('Error checking bookmark:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
