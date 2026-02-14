import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/users/[username]/following
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const { searchParams } = new URL(_req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Resolve user id by username
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userId = userRow.id as string;

    // Get followee IDs (users this account is following) with pagination
    const { data: rels, error: relErr } = await supabase
      .from('user_follows')
      .select('followee_id')
      .eq('follower_id', userId)
      .range(offset, offset + limit - 1);

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

    const followeeIds = (rels || [])
      .map((r: { followee_id: string | null }) => r.followee_id)
      .filter(Boolean) as string[];
    if (followeeIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch followee profiles
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, is_verified')
      .in('id', followeeIds)
      .order('full_name', { ascending: true });

    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

    return NextResponse.json({ data: users || [] });
  } catch (e) {
    console.error('[following API] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
