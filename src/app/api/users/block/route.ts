import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// POST /api/users/block - Block a user
export async function POST(req: NextRequest) {
  const supabase = await createAuthClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { blocked_user_id } = await req.json();
    if (!blocked_user_id) {
      return NextResponse.json({ error: 'Missing blocked_user_id' }, { status: 400 });
    }

    if (blocked_user_id === user.id) {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    // Check if already blocked
    const { data: existing } = await supabase
      .from('user_blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', blocked_user_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ already_blocked: true, success: true });
    }

    const { error: insertErr } = await supabase
      .from('user_blocks')
      .insert({ blocker_id: user.id, blocked_id: blocked_user_id });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    // Optionally remove follow relationships
    await supabase
      .from('user_follows')
      .delete()
      .or(`and(follower_id.eq.${user.id},followee_id.eq.${blocked_user_id}),and(follower_id.eq.${blocked_user_id},followee_id.eq.${user.id})`);

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/users/block - Unblock a user
export async function DELETE(req: NextRequest) {
  const supabase = await createAuthClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { blocked_user_id } = await req.json();
    if (!blocked_user_id) {
      return NextResponse.json({ error: 'Missing blocked_user_id' }, { status: 400 });
    }

    const { error: deleteErr } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blocked_user_id);

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
