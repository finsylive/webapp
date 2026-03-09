import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET — live funding leaderboard
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    const supabase = await createAuthClient();

    // Check arena is enabled
    const { data: event } = await supabase
      .from('events')
      .select('id, arena_enabled, arena_round, virtual_fund_amount, entry_type')
      .eq('id', eventId)
      .single();

    if (!event?.arena_enabled) {
      return NextResponse.json({ error: 'Arena not enabled' }, { status: 400 });
    }

    // Get all stalls
    const { data: stalls } = await supabase
      .from('event_stalls')
      .select('id, stall_name, tagline, logo_url, category, user_id, startup_id')
      .eq('event_id', eventId);

    // Fetch linked startup logos
    const startupIds = (stalls ?? []).map(s => s.startup_id).filter(Boolean) as string[];
    let startupMap: Record<string, { logo_url: string | null; brand_name: string }> = {};
    if (startupIds.length > 0) {
      const { data: startups } = await supabase
        .from('startup_profiles')
        .select('id, logo_url, brand_name')
        .in('id', startupIds);
      startupMap = Object.fromEntries((startups ?? []).map(s => [s.id, s]));
    }

    // Get all investments
    const { data: investments } = await supabase
      .from('event_investments')
      .select('stall_id, amount, investor_id')
      .eq('event_id', eventId);

    // Get audience count
    const { count: audienceCount } = await supabase
      .from('event_audience')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId);

    // Aggregate
    const fundingMap: Record<string, { total: number; investors: Set<string> }> = {};
    for (const inv of investments ?? []) {
      if (!fundingMap[inv.stall_id]) fundingMap[inv.stall_id] = { total: 0, investors: new Set() };
      fundingMap[inv.stall_id].total += inv.amount;
      fundingMap[inv.stall_id].investors.add(inv.investor_id);
    }

    const leaderboard = (stalls ?? []).map((s) => {
      const startup = s.startup_id ? startupMap[s.startup_id] : null;
      return {
        id: s.id,
        stall_name: s.stall_name,
        tagline: s.tagline,
        logo_url: startup?.logo_url || s.logo_url,
        category: s.category,
        total_funding: fundingMap[s.id]?.total ?? 0,
        investor_count: fundingMap[s.id]?.investors.size ?? 0,
      };
    });

    leaderboard.sort((a, b) => b.total_funding - a.total_funding);

    // Compute total invested across all stalls
    const totalInvested = leaderboard.reduce((sum, s) => sum + s.total_funding, 0);

    return NextResponse.json({
      leaderboard,
      total_stalls: stalls?.length ?? 0,
      total_audience: audienceCount ?? 0,
      total_invested: totalInvested,
      arena_round: event.arena_round,
      entry_type: event.entry_type,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}
