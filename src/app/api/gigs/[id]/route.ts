import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { id } = await params;

    const { data: gig, error } = await supabase
      .from('gigs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!gig) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: gig });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
