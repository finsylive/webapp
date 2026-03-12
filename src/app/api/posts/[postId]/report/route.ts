import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// POST /api/posts/[postId]/report — report a post
export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const { postId } = await params;
    const supabase = await createAuthClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reason, additional_info } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'A reason is required' }, { status: 400 });
    }

    // Check if user already reported this post
    const { data: existing } = await supabase
      .from('post_reports')
      .select('id')
      .eq('reporter_id', user.id)
      .eq('reported_post_id', postId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'You have already reported this post', already_reported: true }, { status: 409 });
    }

    const { error } = await supabase
      .from('post_reports')
      .insert({
        reporter_id: user.id,
        reported_post_id: postId,
        reason: reason.trim(),
        additional_info: additional_info?.trim() || null,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reporting post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
