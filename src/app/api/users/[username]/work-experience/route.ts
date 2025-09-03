import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// GET /api/users/[username]/work-experience
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Resolve user by username
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userError) {
      console.error('[work-experience API] error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch work experiences with nested positions
    // Note: order experiences by sort_order asc, and positions by sort_order asc then start_date desc
    const { data, error } = await supabase
      .from('work_experiences')
      .select(`
        id,
        user_id,
        company_name,
        domain,
        sort_order,
        positions (
          id,
          experience_id,
          position,
          start_date,
          end_date,
          description,
          sort_order
        )
      `)
      .eq('user_id', userRow.id)
      .order('sort_order', { ascending: true })
      .order('sort_order', { ascending: true, foreignTable: 'positions' })
      .order('start_date', { ascending: false, foreignTable: 'positions' });

    if (error) {
      console.error('[work-experience API] error fetching data:', error);
      return NextResponse.json({ error: 'Failed to fetch work experience', details: error.message }, { status: 500 });
    }

    // Normalize payload
    const experiences = (data || []).map((we: any) => ({
      id: we.id,
      company_name: we.company_name,
      domain: we.domain,
      sort_order: we.sort_order,
      positions: (we.positions || []).map((p: any) => ({
        id: p.id,
        experience_id: p.experience_id,
        position: p.position,
        start_date: p.start_date,
        end_date: p.end_date,
        description: p.description,
        sort_order: p.sort_order,
      }))
    }));

    return NextResponse.json({ data: { experiences } });
  } catch (e) {
    console.error('[work-experience API] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
