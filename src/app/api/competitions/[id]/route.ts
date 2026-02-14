import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { id } = await params;
    const [{ data: competition, error }, entriesAgg] = await Promise.all([
      supabase.from('competitions').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('competition_entries')
        .select('submitted_by', { count: 'exact', head: true })
        .eq('competition_id', id),
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!competition) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: competition, participants: entriesAgg.count || 0 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

