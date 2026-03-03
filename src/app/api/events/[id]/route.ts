import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { id } = await params;

    const [{ data: event, error }, participantsAgg] = await Promise.all([
      supabase.from('events').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('event_participants')
        .select('user_id', { count: 'exact', head: true })
        .eq('event_id', id),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: event, participants: participantsAgg.count || 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
