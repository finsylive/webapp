import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Handle session management
    if (body.session) {
      const { id, user_id, action, device_type } = body.session;

      if (user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (action === 'start') {
        await supabase.from('user_sessions').upsert({
          id,
          user_id,
          device_type: device_type || 'unknown',
          started_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          events_count: 0,
          feed_depth: 0,
        });
      } else if (action === 'heartbeat') {
        await supabase
          .from('user_sessions')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', id);
      } else if (action === 'end') {
        await supabase
          .from('user_sessions')
          .update({
            ended_at: new Date().toISOString(),
            last_active_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      return NextResponse.json({ ok: true });
    }

    // Handle event batch
    if (body.events && Array.isArray(body.events)) {
      // Validate all events belong to this user
      const events = body.events.filter(
        (e: { user_id: string }) => e.user_id === user.id
      );

      if (events.length === 0) {
        return NextResponse.json({ ok: true, inserted: 0 });
      }

      // Use RPC for bulk insert
      const { data, error } = await supabase.rpc('batch_insert_feed_events', {
        events: JSON.stringify(events),
      });

      if (error) {
        // Fallback: insert events individually
        const { error: insertError } = await supabase
          .from('feed_events')
          .insert(events);

        if (insertError) {
          console.error('Error inserting feed events:', insertError);
          return NextResponse.json({ error: 'Failed to insert events' }, { status: 500 });
        }

        // Also mark impressions as seen
        const impressions = events.filter((e: { event_type: string }) => e.event_type === 'impression');
        if (impressions.length > 0) {
          const seenPosts = impressions.map((e: { user_id: string; post_id: string }) => ({
            user_id: e.user_id,
            post_id: e.post_id,
          }));
          await supabase.from('feed_seen_posts').upsert(seenPosts, {
            onConflict: 'user_id,post_id',
            ignoreDuplicates: true,
          });
        }

        return NextResponse.json({ ok: true, inserted: events.length });
      }

      // Update interaction graph for significant events (with retry)
      const significantEvents = events.filter(
        (e: { event_type: string }) =>
          ['like', 'reply', 'share', 'bookmark', 'click', 'profile_click'].includes(e.event_type)
      );

      // Group by target author to batch per-author updates
      const byAuthor = new Map<string, string[]>();
      for (const event of significantEvents as { author_id: string; event_type: string }[]) {
        if (!event.author_id) continue;
        const existing = byAuthor.get(event.author_id) || [];
        existing.push(event.event_type);
        byAuthor.set(event.author_id, existing);
      }

      // Retry up to 3 attempts per author
      await Promise.allSettled(
        [...byAuthor.entries()].map(async ([authorId, eventTypes]) => {
          for (let attempt = 0; attempt < 3; attempt++) {
            const { error: graphError } = await supabase.rpc('update_interaction_graph', {
              p_user_id: user.id,
              p_target_user_id: authorId,
              p_event_type: eventTypes[0],
            });
            if (!graphError) return;
            if (attempt < 2) {
              console.warn(`[Feed] Interaction graph update failed for ${authorId} (attempt ${attempt + 1}):`, graphError.message);
            }
          }
        })
      );

      return NextResponse.json({ ok: true, inserted: data ?? events.length });
    }

    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  } catch (error) {
    console.error('Error in feed events API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
