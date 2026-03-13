import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET — list stalls for an event
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    const { data: stalls, error } = await supabase
      .from('event_stalls')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Fetch linked startups separately (no FK relationship in schema cache)
    const startupIds = (stalls ?? []).map(s => s.startup_id).filter(Boolean);
    let startupMap: Record<string, { id: string; brand_name: string; logo_url: string | null; stage: string; website: string | null }> = {};
    if (startupIds.length > 0) {
      const { data: startups } = await supabase
        .from('startup_profiles')
        .select('id, brand_name, logo_url, stage, website')
        .in('id', startupIds);
      startupMap = Object.fromEntries((startups ?? []).map(s => [s.id, s]));
    }

    const enriched = (stalls ?? []).map(s => ({
      ...s,
      startup: s.startup_id ? startupMap[s.startup_id] ?? null : null,
    }));

    return NextResponse.json({ stalls: enriched });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

// POST — register a stall (Round 1)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Check event exists and arena is enabled in registration round
    const { data: event } = await supabase
      .from('events')
      .select('id, arena_enabled, arena_round, entry_type')
      .eq('id', eventId)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!event.arena_enabled) return NextResponse.json({ error: 'Arena not enabled for this event' }, { status: 400 });
    if (event.arena_round !== 'registration') return NextResponse.json({ error: 'Stall registration is not open' }, { status: 400 });

    const body = await req.json();
    const { stall_name, tagline, description, startup_id, category } = body;

    if (!stall_name?.trim()) return NextResponse.json({ error: 'Stall name is required' }, { status: 400 });

    // If startup_id provided, verify user owns it or is a founder
    if (startup_id) {
      const [{ data: owned }, { data: founder }] = await Promise.all([
        supabase.from('startup_profiles').select('id').eq('id', startup_id).eq('owner_id', user.id).maybeSingle(),
        supabase.from('startup_founders').select('id').eq('startup_id', startup_id).eq('user_id', user.id).eq('status', 'accepted').maybeSingle(),
      ]);
      if (!owned && !founder) {
        return NextResponse.json({ error: 'You are not authorized to link this startup' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('event_stalls')
      .insert({
        event_id: eventId,
        user_id: user.id,
        stall_name: stall_name.trim(),
        tagline: tagline?.trim() || null,
        description: description?.trim() || null,
        startup_id: startup_id || null,
        category: category?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message?.includes('unique constraint') || error.message?.includes('duplicate key')) {
        return NextResponse.json({ error: 'You have already registered a stall for this event' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, stall: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
