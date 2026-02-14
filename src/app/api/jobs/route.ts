import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const limit = Number(searchParams.get('limit') || '20');
    const orderBy = (searchParams.get('orderBy') || 'created_at') as 'created_at' | 'deadline';
    const ascending = searchParams.get('ascending') === 'true';

    let query = supabase
      .from('jobs')
      .select('*')
      .order(orderBy, { ascending, nullsFirst: false })
      .limit(Math.max(1, Math.min(100, limit)));

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unexpected error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
