import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';

// Quick ping to verify route registration
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return NextResponse.json({ ok: true, username, route: '/api/users/[username]/follow' });
}

// POST /api/users/[username]/follow
// Body: { followerId: string; follow: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const { follow } = await req.json();

    if (!username || typeof follow !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Derive follower identity from session — never trust client-supplied followerId
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const followerId = user.id;

    const supabase = createAdminClient();

    // Resolve target user's ID by username
    const { data: userRow, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userLookupError) {
      return NextResponse.json({ error: userLookupError.message }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUserId = userRow.id as string;

    if (targetUserId === followerId) {
      return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 });
    }

    if (follow) {
      // Upsert follow relation
      const { error } = await supabase
        .from('user_follows')
        .upsert(
          [
            {
              follower_id: followerId,
              followee_id: targetUserId,
            },
          ],
          { onConflict: 'follower_id,followee_id' }
        );

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Fire-and-forget push notification via edge function (best effort)
      try {
        fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/push-on-follow`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({ followerId, followeeId: targetUserId }),
          // do not await; errors are non-fatal
        }).catch(() => { });
      } catch {
        // ignore
      }
    } else {
      // Remove follow relation
      const { error } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followee_id', targetUserId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in follow API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

