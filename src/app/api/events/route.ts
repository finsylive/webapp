import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('activeOnly') !== 'false';
    const category = searchParams.get('category'); // event_type filter: online, in-person, hybrid
    const limit = Number(searchParams.get('limit') || '50');
    const orderBy = (searchParams.get('orderBy') || 'event_date') as string;
    const ascending = searchParams.get('ascending') === 'true';

    let query = supabase
      .from('events')
      .select('*')
      .order(orderBy, { ascending, nullsFirst: false })
      .limit(Math.max(1, Math.min(100, limit)));

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    if (category) {
      query = query.eq('event_type', category);
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
