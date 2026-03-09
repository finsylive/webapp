import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// POST — invest in a stall
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Check event is in investment round
    const { data: event } = await supabase
      .from('events')
      .select('id, arena_enabled, arena_round')
      .eq('id', eventId)
      .single();

    if (!event?.arena_enabled) return NextResponse.json({ error: 'Arena not enabled' }, { status: 400 });
    if (event.arena_round !== 'investment') return NextResponse.json({ error: 'Investment round is not open' }, { status: 400 });

    const body = await req.json();
    const { stall_id, amount } = body;

    if (!stall_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid stall_id and positive amount are required' }, { status: 400 });
    }

    const investAmount = Math.floor(amount);

    // Check stall exists for this event
    const { data: stall } = await supabase
      .from('event_stalls')
      .select('id, user_id')
      .eq('id', stall_id)
      .eq('event_id', eventId)
      .single();

    if (!stall) return NextResponse.json({ error: 'Stall not found' }, { status: 404 });

    // Cannot invest in own stall
    if (stall.user_id === user.id) {
      return NextResponse.json({ error: 'You cannot invest in your own stall' }, { status: 400 });
    }

    // Get audience balance
    const { data: audience } = await supabase
      .from('event_audience')
      .select('id, virtual_balance')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single();

    if (!audience) return NextResponse.json({ error: 'You must register as audience first' }, { status: 403 });
    if (audience.virtual_balance < investAmount) {
      return NextResponse.json({
        error: `Insufficient balance. You have ₹${audience.virtual_balance.toLocaleString('en-IN')} remaining.`,
      }, { status: 400 });
    }

    // Create investment record
    const { error: investError } = await supabase
      .from('event_investments')
      .insert({
        event_id: eventId,
        stall_id,
        investor_id: user.id,
        amount: investAmount,
      });

    if (investError) return NextResponse.json({ error: investError.message }, { status: 500 });

    // Deduct from audience balance
    const newBalance = audience.virtual_balance - investAmount;
    const { error: updateError } = await supabase
      .from('event_audience')
      .update({ virtual_balance: newBalance })
      .eq('id', audience.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      remaining_balance: newBalance,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
