import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { id } = await params;

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!job) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: job });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
