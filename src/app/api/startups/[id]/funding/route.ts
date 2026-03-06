import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';
import { upsertFundingRounds } from '@/api/startups';
import { supabase } from '@/utils/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await supabase
      .from('startup_funding_rounds')
      .select('*')
      .eq('startup_id', id)
      .order('round_date', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching funding rounds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const authSupabase = await createAuthClient();
    const { data: { user } } = await authSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rounds } = await request.json();
    const { error } = await upsertFundingRounds(id, rounds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating funding rounds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
