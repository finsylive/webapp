import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';

type EducationRow = {
  id: string;
  user_id: string;
  institution_name: string;
  institution_domain: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number | null;
};

// Helper: get authenticated user id via cookie-based auth client
async function getRequesterId() {
  const authClient = await createAuthClient();
  const { data: auth } = await authClient.auth.getUser();
  return auth?.user?.id || null;
}

// GET /api/users/[username]/education
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { searchParams } = new URL(req.url);
    const idFilter = searchParams.get('id');

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const supabase = createAdminClient();

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let query = supabase
      .from('education')
      .select('*')
      .eq('user_id', userRow.id);

    if (idFilter) {
      query = query.eq('id', idFilter);
    }

    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('start_date', { ascending: false });

    if (error) {
      console.error('[education GET] error:', error);
      return NextResponse.json({ error: 'Failed to fetch education' }, { status: 500 });
    }

    return NextResponse.json({ data: { education: data || [] } });
  } catch (e) {
    console.error('[education GET] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/education
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const body = await req.json();

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!body.institution_name || typeof body.institution_name !== 'string') {
      return NextResponse.json({ error: 'institution_name is required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const requesterId = await getRequesterId();

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!requesterId || requesterId !== userRow.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Next sort order
    const { data: maxEd } = await supabase
      .from('education')
      .select('sort_order')
      .eq('user_id', userRow.id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = typeof maxEd?.sort_order === 'number' ? maxEd.sort_order + 1 : 0;

    const payload = {
      user_id: userRow.id,
      institution_name: body.institution_name.toString().trim(),
      institution_domain: body.institution_domain?.trim() || null,
      degree: body.degree?.trim() || null,
      field_of_study: body.field_of_study?.trim() || null,
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      description: body.description?.trim() || null,
      sort_order: nextOrder,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('education')
      .insert(payload)
      .select('id')
      .single();

    if (insErr) {
      console.error('[education POST] insert error:', insErr);
      return NextResponse.json({ error: 'Failed to create education' }, { status: 500 });
    }

    return NextResponse.json({ data: { id: inserted?.id } }, { status: 201 });
  } catch (e) {
    console.error('[education POST] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/users/[username]/education
// Body: { order: string[] } to reorder, OR { id, ...fields } to update a single entry
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const order = Array.isArray(body?.order) ? body.order as string[] : [];

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const supabase = createAdminClient();
    const requesterId = await getRequesterId();

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!requesterId || requesterId !== userRow.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Reorder mode
    if (order.length) {
      const { data: edus } = await supabase
        .from('education')
        .select('id')
        .eq('user_id', userRow.id);
      const allowed = new Set((edus || []).map((r: { id: string }) => r.id));
      for (const id of order) {
        if (!allowed.has(id)) return NextResponse.json({ error: 'Invalid education id' }, { status: 400 });
      }
      for (let i = 0; i < order.length; i++) {
        await supabase.from('education').update({ sort_order: i }).eq('id', order[i]).eq('user_id', userRow.id);
      }
      return NextResponse.json({ success: true });
    }

    // Update single entry
    const targetId = body.id as string;
    if (!targetId) return NextResponse.json({ error: 'id is required for update' }, { status: 400 });

    const patch: Partial<EducationRow> = {};
    if (typeof body.institution_name === 'string') patch.institution_name = body.institution_name.trim();
    if (typeof body.institution_domain !== 'undefined') patch.institution_domain = body.institution_domain?.trim() || null;
    if (typeof body.degree !== 'undefined') patch.degree = body.degree?.trim() || null;
    if (typeof body.field_of_study !== 'undefined') patch.field_of_study = body.field_of_study?.trim() || null;
    if (typeof body.start_date !== 'undefined') patch.start_date = body.start_date || null;
    if (typeof body.end_date !== 'undefined') patch.end_date = body.end_date || null;
    if (typeof body.description !== 'undefined') patch.description = body.description?.trim() || null;

    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { error: updErr } = await supabase
      .from('education')
      .update(patch)
      .eq('id', targetId)
      .eq('user_id', userRow.id);
    if (updErr) return NextResponse.json({ error: 'Failed to update education' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[education PATCH] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/education?id=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!username || !id) return NextResponse.json({ error: 'Username and id are required' }, { status: 400 });

    const supabase = createAdminClient();
    const requesterId = await getRequesterId();

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow || !requesterId || requesterId !== userRow.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: edRow } = await supabase
      .from('education')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle();
    if (!edRow || edRow.user_id !== userRow.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { error: delErr } = await supabase
      .from('education')
      .delete()
      .eq('id', id)
      .eq('user_id', userRow.id);
    if (delErr) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[education DELETE] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
