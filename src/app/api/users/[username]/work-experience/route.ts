import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

type Position = {
  id: string;
  experience_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number | null;
};

type WorkExperience = {
  id: string;
  user_id: string;
  company_name: string;
  domain: string | null;
  sort_order: number | null;
  positions: Position[];
};

// POST /api/users/[username]/work-experience
// Body: { companyName: string, domain?: string|null }

// DELETE /api/users/[username]/work-experience?id=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!username || !id) {
      return NextResponse.json({ error: 'Username and id are required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: async () => cookieStore });

    // auth and owner
    const { data: auth } = await supabase.auth.getUser();
    const requesterId = auth?.user?.id || null;
    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow || !requesterId || requesterId !== userRow.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ensure the experience belongs to this user
    const { data: expRow } = await supabase
      .from('work_experiences')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!expRow || expRow.user_id !== userRow.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Optionally delete positions first if cascade is not configured
    await supabase.from('positions').delete().eq('experience_id', id);

    const { error: delErr } = await supabase
      .from('work_experiences')
      .delete()
      .eq('id', id)
      .eq('user_id', userRow.id);
    if (delErr) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[work-experience DELETE] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { companyName, domain } = await req.json();

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!companyName || typeof companyName !== 'string') return NextResponse.json({ error: 'companyName is required' }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: async () => cookieStore });

    // auth
    const { data: auth } = await supabase.auth.getUser();
    const requesterId = auth?.user?.id || null;

    // profile owner
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (userError) return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!requesterId || requesterId !== userRow.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // find next sort order for experiences
    const { data: maxWe, error: maxErr } = await supabase
      .from('work_experiences')
      .select('sort_order')
      .eq('user_id', userRow.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxErr && maxErr.code !== 'PGRST116') {
      console.warn('[work-experience POST] sort_order fetch error:', maxErr);
    }
    const nextOrder = typeof maxWe?.sort_order === 'number' ? (maxWe!.sort_order! + 1) : 0;

    const payload = {
      user_id: userRow.id,
      company_name: companyName.toString(),
      domain: domain ? String(domain) : null,
      sort_order: nextOrder,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('work_experiences')
      .insert(payload)
      .select('id')
      .single();
    if (insErr) return NextResponse.json({ error: 'Failed to create experience', details: insErr.message }, { status: 500 });

    return NextResponse.json({ data: { id: inserted?.id } }, { status: 201 });
  } catch (e) {
    console.error('[work-experience POST] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/users/[username]/work-experience
// Body: { order: string[] }  // array of experience IDs ordered top-to-bottom
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({} as { order?: string[]; id?: string; company_name?: string; domain?: string|null }));
    const order = Array.isArray(body?.order) ? body.order : [];

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    // Two modes: reorder (order array provided) or update single row (id with fields)

    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Authenticated user
    const { data: auth } = await supabase.auth.getUser();
    const requesterId = auth?.user?.id || null;

    // Resolve profile owner by username
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userError) {
      console.error('[work-experience PATCH] error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }
    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (!requesterId || requesterId !== userRow.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (order.length) {
      // Validate IDs belong to user
      const { data: exps, error: listErr } = await supabase
        .from('work_experiences')
        .select('id')
        .eq('user_id', userRow.id);
      if (listErr) {
        console.error('[work-experience PATCH] fetch exps error:', listErr);
        return NextResponse.json({ error: 'Failed to read experiences' }, { status: 500 });
      }
      const allowed = new Set((exps || []).map((r: { id: string }) => r.id));
      for (const id of order) {
        if (!allowed.has(id)) {
          return NextResponse.json({ error: 'Invalid experience id in order' }, { status: 400 });
        }
      }

      // Update sort_order sequentially
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        const { error: updErr } = await supabase
          .from('work_experiences')
          .update({ sort_order: i })
          .eq('id', id)
          .eq('user_id', userRow.id);
        if (updErr) {
          console.error('[work-experience PATCH] update error:', updErr);
          return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
        }
      }
      return NextResponse.json({ success: true });
    }

    // Update single experience
    const targetId = body.id;
    if (!targetId) return NextResponse.json({ error: 'id is required for update' }, { status: 400 });
    const patch: Partial<{ company_name: string; domain: string | null }> = {};
    if (typeof body.company_name === 'string') patch.company_name = body.company_name;
    if (typeof body.domain !== 'undefined') patch.domain = body.domain;
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { error: updOneErr } = await supabase
      .from('work_experiences')
      .update(patch)
      .eq('id', targetId)
      .eq('user_id', userRow.id);
    if (updOneErr) return NextResponse.json({ error: 'Failed to update experience' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[work-experience PATCH] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/users/[username]/work-experience
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { searchParams } = new URL(req.url);
    const idFilter = searchParams.get('id');

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
    let weQuery = supabase
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
      .eq('user_id', userRow.id);

    if (idFilter) {
      weQuery = weQuery.eq('id', idFilter);
    }

    const { data, error } = await weQuery
      .order('sort_order', { ascending: true })
      .order('sort_order', { ascending: true, foreignTable: 'positions' })
      .order('start_date', { ascending: false, foreignTable: 'positions' });

    if (error) {
      console.error('[work-experience API] error fetching data:', error);
      return NextResponse.json({ error: 'Failed to fetch work experience', details: error.message }, { status: 500 });
    }

    // Normalize payload
    const experiences = (data || []).map((we: WorkExperience) => ({
      id: we.id,
      company_name: we.company_name,
      domain: we.domain,
      sort_order: we.sort_order,
      positions: (we.positions || []).map((p: Position) => ({
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
