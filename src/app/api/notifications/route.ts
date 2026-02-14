import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/notifications?userId=...&page=...&limit=...&unreadOnly=...&type=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type');

    if (!userId) {
      return NextResponse.json({ error: 'userId parameter is required' }, { status: 400 });
    }

    const offset = (page - 1) * limit;
    // Each table gets half the limit to avoid over-fetching, then merge
    const perTableLimit = limit + 1; // Fetch one extra to detect hasMore

    const supabase = await createAuthClient();

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
            .select('id, recipient_id, type, message, is_read, created_at, data', { count: 'exact' })
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
    const legacyList: NotifRow[] = (legacyResult.data || []).map(n => ({
      ...n,
      notification_source: 'legacy',
      is_read: n.read,
      recipient_id: n.user_id,
    }));
    const inappList: NotifRow[] = (inappResult.data || []).map(n => ({
      ...n,
      notification_source: 'inapp',
      read: n.is_read,
      user_id: n.recipient_id,
    }));

    // Merge and sort
    const merged = [...legacyList, ...inappList]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    const total = (legacyResult.count || 0) + (inappResult.count || 0);

    return NextResponse.json({
      data: merged,
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

// PATCH method to mark notifications as read — updates BOTH tables
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, notificationIds, markAllAsRead } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const supabase = await createAuthClient();

    if (markAllAsRead) {
      // Mark all unread in both tables
      await Promise.all([
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .eq('read', false),
        supabase
          .from('inapp_notification')
          .update({ is_read: true })
          .eq('recipient_id', userId)
          .eq('is_read', false),
      ]);
    } else if (notificationIds && Array.isArray(notificationIds)) {
      // Update specific IDs in both tables (IDs will only match in one)
      await Promise.all([
        supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', userId)
          .in('id', notificationIds),
        supabase
          .from('inapp_notification')
          .update({ is_read: true })
          .eq('recipient_id', userId)
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

// HEAD method for unread count — counts BOTH tables
export async function HEAD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return new NextResponse(null, { status: 400, headers: { 'X-Error': 'userId parameter is required' } });
    }

    const supabase = await createAuthClient();

    const [legacyCount, inappCount] = await Promise.all([
      (async () => {
        try {
          const r = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('read', false);
          return r.count || 0;
        } catch { return 0; }
      })(),
      (async () => {
        try {
          const r = await supabase
            .from('inapp_notification')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', userId)
            .eq('is_read', false);
          return r.count || 0;
        } catch { return 0; }
      })(),
    ]);

    const totalUnread = legacyCount + inappCount;

    return new NextResponse(null, {
      status: 200,
      headers: { 'X-Unread-Count': totalUnread.toString() },
    });
  } catch {
    return new NextResponse(null, { status: 500, headers: { 'X-Error': 'Internal server error' } });
  }
}
