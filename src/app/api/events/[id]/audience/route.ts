import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// POST — register as audience investor (Round 2)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Check event and round
    const { data: event } = await supabase
      .from('events')
      .select('id, arena_enabled, arena_round, virtual_fund_amount')
      .eq('id', eventId)
      .single();

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    if (!event.arena_enabled) return NextResponse.json({ error: 'Arena not enabled' }, { status: 400 });
    if (event.arena_round !== 'investment') return NextResponse.json({ error: 'Investment round is not open yet' }, { status: 400 });

    // Check user is NOT a stall owner (audience only)
    const { data: existingStall } = await supabase
      .from('event_stalls')
      .select('id')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingStall) {
      return NextResponse.json({ error: 'Stall owners cannot join as audience. You are already a participant in Round 1.' }, { status: 403 });
    }

    // Register as audience with virtual balance
    const { data, error } = await supabase
      .from('event_audience')
      .insert({
        event_id: eventId,
        user_id: user.id,
        virtual_balance: event.virtual_fund_amount,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Already registered, fetch their balance
        const { data: existing } = await supabase
          .from('event_audience')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .single();
        return NextResponse.json({ success: true, audience: existing, alreadyJoined: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, audience: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

// GET — get current user's audience status & balance
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const [audienceRes, stallRes] = await Promise.all([
      supabase
        .from('event_audience')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('event_stalls')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      audience: audienceRes.data,
      isStallOwner: !!stallRes.data,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
