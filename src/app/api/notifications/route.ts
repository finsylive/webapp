import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/notifications?userId=...&page=...&limit=...&unreadOnly=...&type=...
export async function GET(request: NextRequest) {
  try {
    // Verify session — user may only read their own notifications
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    // Accept userId param for compatibility but always enforce it equals the session user
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const userId = user.id;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type');

    const offset = (page - 1) * limit;
    const perTableLimit = limit + 1;

    const supabase = authClient;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type NotifRow = Record<string, any>;

    // Fetch from both tables in parallel with DB-level pagination
    const [legacyResult, inappResult] = await Promise.all([
      (async () => {
        try {
          let q = supabase
            .from('notifications')
            .select('id, user_id, type, message, read, created_at, data', { count: 'exact' })
            .eq('user_id', userId);
          if (unreadOnly) q = q.eq('read', false);
          if (type) q = q.eq('type', type);
          q = q.order('created_at', { ascending: false }).range(offset, offset + perTableLimit - 1);
          const { data, count, error } = await q;
          return { data: data || [], count: count || 0, error };
        } catch {
          return { data: [] as NotifRow[], count: 0, error: null };
        }
      })(),
      (async () => {
        try {
          let q = supabase
            .from('inapp_notification')
            .select('id, recipient_id, type, content, is_read, created_at, extra, actor_id, actor_name, actor_avatar_url, actor_username', { count: 'exact' })
            .eq('recipient_id', userId);
          if (unreadOnly) q = q.eq('is_read', false);
          if (type) q = q.eq('type', type);
          q = q.order('created_at', { ascending: false }).range(offset, offset + perTableLimit - 1);
          const { data, count, error } = await q;
          return { data: data || [], count: count || 0, error };
        } catch {
          return { data: [] as NotifRow[], count: 0, error: null };
        }
      })(),
    ]);

    // Normalize both sources
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const legacyList: NotifRow[] = (legacyResult.data || []).map((n: any) => ({
      ...n,
      notification_source: 'legacy',
      is_read: n.read,
      recipient_id: n.user_id,
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inappList: NotifRow[] = (inappResult.data || []).map((n: any) => ({
      ...n,
      notification_source: 'inapp',
      read: n.is_read,
      user_id: n.recipient_id,
      message: n.content,
      data: n.extra,
    }));

    // Merge and sort
    const merged = [...legacyList, ...inappList]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // Extract unique actor IDs
    const actorIds = new Set<string>();
    for (const n of merged) {
      const d = n.data || {};
      const actorId = n.actor_id || d.actor_id || d.from_user_id || d.sender_id || d.follower_id || d.requester_id || d.user_id;
      if (actorId) actorIds.add(actorId);
    }

    // Fetch actor profiles in one query
    const actorMap: Record<string, { username: string; full_name: string | null; avatar_url: string | null }> = {};
    if (actorIds.size > 0) {
      try {
        const { data: actors } = await supabase
          .from('users')
          .select('id, username, full_name, avatar_url')
          .in('id', Array.from(actorIds))
          .eq('account_status', 'active');
        if (actors) {
          for (const a of actors) {
            actorMap[a.id] = { username: a.username, full_name: a.full_name, avatar_url: a.avatar_url };
          }
        }
      } catch {
        // non-critical
      }
    }

    const mapped = merged.map((n) => {
      const d = n.data || {};
      const actorId = n.actor_id || d.actor_id || d.from_user_id || d.sender_id || d.follower_id || d.requester_id || d.user_id || null;
      const actor = actorId ? actorMap[actorId] : null;

      return {
        id: n.id,
        type: n.type,
        content: n.message || d.message || d.content || null,
        created_at: n.created_at,
        actor_id: actorId,
        actor_name: actor?.full_name || n.actor_name || d.actor_name || d.sender_name || null,
        actor_username: actor?.username || n.actor_username || d.actor_username || d.sender_username || null,
        actor_avatar_url: actor?.avatar_url || n.actor_avatar_url || d.actor_avatar_url || d.sender_avatar_url || null,
        post_id: d.post_id || d.postId || null,
        notification_source: n.notification_source,
        is_read: n.is_read,
        data: n.type === 'cofounder_request' ? d : undefined,
      };
    });

    const total = (legacyResult.count || 0) + (inappResult.count || 0);

    return NextResponse.json({
      data: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH — mark notifications as read
export async function PATCH(request: NextRequest) {
  try {
    // Verify session — user may only mark their own notifications read
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { userId, notificationIds, markAllAsRead } = body;

    // Enforce session user matches any provided userId
    if (userId && userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const targetUserId = user.id;

    const supabase = authClient;

    if (markAllAsRead) {
      await Promise.all([
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', targetUserId)
          .eq('read', false),
        supabase
          .from('inapp_notification')
          .update({ is_read: true })
          .eq('recipient_id', targetUserId)
          .eq('is_read', false),
      ]);
    } else if (notificationIds && Array.isArray(notificationIds)) {
      await Promise.all([
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', targetUserId)
          .in('id', notificationIds),
        supabase
          .from('inapp_notification')
          .update({ is_read: true })
          .eq('recipient_id', targetUserId)
          .in('id', notificationIds),
      ]);
    } else {
      return NextResponse.json({ error: 'Either notificationIds array or markAllAsRead flag is required' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// HEAD — unread count (used for badge in the nav)
export async function HEAD(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return new NextResponse(null, { status: 401 });
    }

    // Accept userId param for compatibility but always enforce it equals session user
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    if (requestedUserId && requestedUserId !== user.id) {
      return new NextResponse(null, { status: 403 });
    }

    const supabase = authClient;

    const [legacyCount, inappCount] = await Promise.all([
      (async () => {
        try {
          const r = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('read', false);
          return r.count || 0;
        } catch { return 0; }
      })(),
      (async () => {
        try {
          const r = await supabase
            .from('inapp_notification')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', user.id)
            .eq('is_read', false);
          return r.count || 0;
        } catch { return 0; }
      })(),
    ]);

    return new NextResponse(null, {
      status: 200,
      headers: { 'X-Unread-Count': (legacyCount + inappCount).toString() },
    });
  } catch {
    return new NextResponse(null, { status: 500, headers: { 'X-Error': 'Internal server error' } });
  }
}
