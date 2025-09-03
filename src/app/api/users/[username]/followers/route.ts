import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/users/[username]/followers
export async function GET(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get('viewerId');

    // Resolve user id by username
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 500 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const userId = userRow.id as string;

    // Get follower IDs
    const { data: rels, error: relErr } = await supabase
      .from('user_follows')
      .select('follower_id')
      .eq('followee_id', userId)
      .limit(2000);

    if (relErr) return NextResponse.json({ error: relErr.message }, { status: 500 });

    const followerIds = (rels || []).map((r: { follower_id: string | null }) => r.follower_id).filter(Boolean) as string[];
    if (followerIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Fetch follower profiles
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, is_verified')
      .in('id', followerIds)
      .order('full_name', { ascending: true });

    if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

    // If there's a viewer, get their follow status for each follower
    let followStatusMap: Record<string, boolean> = {};
    if (viewerId && users && users.length > 0) {
      const { data: viewerFollows, error: followErr } = await supabase
        .from('user_follows')
        .select('followee_id')
        .eq('follower_id', viewerId)
        .in('followee_id', users.map(u => u.id));
      
      if (!followErr && viewerFollows) {
        followStatusMap = viewerFollows.reduce((acc, f) => {
          acc[f.followee_id] = true;
          return acc;
        }, {} as Record<string, boolean>);
      }
    }

    // Add follow status to each user
    const usersWithFollowStatus = (users || []).map(user => ({
      ...user,
      is_following: followStatusMap[user.id] || false
    }));

    return NextResponse.json({ data: usersWithFollowStatus });
  } catch (e) {
    console.error('[followers API] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
