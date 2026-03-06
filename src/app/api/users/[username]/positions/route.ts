// positions api
import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// Type for the database query result which has work_experiences as an array
type DatabasePositionRow = {
  id: string;
  experience_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
  work_experiences: {
    id: string;
    company: string | null;
    company_name: string | null;
    role: string | null;
    user_id: string;
  }[];
};

// Basic position row when not joining work_experiences
type BasicPositionRow = {
  id: string;
  experience_id: string;
  position: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
};

type SimpleError = { message: string } | null;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { searchParams } = new URL(req.url);
    let experienceIdFilter = searchParams.get('experienceId');
    if (experienceIdFilter === 'null' || experienceIdFilter === 'undefined') experienceIdFilter = null;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Create an authenticated Supabase client bound to cookies (so RLS applies)
    // Use the same cookie binding style as other endpoints to avoid subtle session issues
    const supabase = await createAuthClient();

    // First, get the user ID from username
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .eq('account_status', 'active')
      .maybeSingle();

    if (userError) {
      console.warn('[positions API] error fetching user:', userError.message);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let positions: (BasicPositionRow | DatabasePositionRow)[] | null = null;
    let positionsError: SimpleError = null;

    if (experienceIdFilter) {
      // Verify the experience belongs to the user
      const { data: expRow, error: expErr } = await supabase
        .from('work_experiences')
        .select('id,user_id')
        .eq('id', experienceIdFilter)
        .maybeSingle();
      if (expErr) {
        positionsError = { message: expErr.message };
      } else if (!expRow || expRow.user_id !== userRow.id) {
        positions = [];
      } else {
        const { data, error } = await supabase
          .from('positions')
          .select('id,experience_id,position,start_date,end_date,description,sort_order')
          .eq('experience_id', experienceIdFilter)
          .order('sort_order', { ascending: true })
          .order('start_date', { ascending: false });
        positions = (data as BasicPositionRow[] | null) ?? [];
        positionsError = error ? { message: error.message } : null;
      }
    } else {
      // Fetch positions with work experience data (inner join ensures only user's experiences)
      const query = supabase
        .from('positions')
        .select(`
          id,
          experience_id,
          position,
          start_date,
          end_date,
          description,
          sort_order,
          work_experiences!inner (
            id,
            company,
            company_name,
            role,
            user_id
          )
        `)
        .eq('work_experiences.user_id', userRow.id)
        .order('sort_order', { ascending: true })
        .order('start_date', { ascending: false });
      const { data, error } = await query;
      positions = (data as DatabasePositionRow[] | null) ?? [];
      positionsError = error ? { message: error.message } : null;
    }

    if (positionsError) {
      console.error('[positions API] error fetching positions:', positionsError);
      return NextResponse.json({ error: 'Failed to fetch positions', details: positionsError.message }, { status: 500 });
    }

    // Transform the data to match expected format (keeping backward compatibility)
    const formattedPositions = (positions || []).map((position) => {
      const work_experience = 'work_experiences' in position
        ? (position.work_experiences?.[0] ?? null)
        : null;
      return {
        id: position.id,
        experience_id: position.experience_id,
        title: position.position, // Map 'position' field to 'title' for backward compatibility
        position: position.position, // Also include the actual field name
        start_date: position.start_date,
        end_date: position.end_date,
        description: position.description,
        sort_order: position.sort_order,
        work_experience,
      };
    });

    return NextResponse.json({
      data: formattedPositions,
      count: formattedPositions.length
    });

  } catch (error) {
    console.error('Error in positions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/users/[username]/positions
// Body: { id: string, position?: string, description?: string|null, startDate?: string|null, endDate?: string|null }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const body = await req.json().catch(() => ({} as { id?: string; position?: string; description?: string | null; startDate?: string | null; endDate?: string | null }));
    const id = body.id || '';
    if (!username || !id) return NextResponse.json({ error: 'Username and id are required' }, { status: 400 });

    const supabase = await createAuthClient();

    // Resolve owner and auth
    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!userRow || auth.user.id !== userRow.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Ensure the position belongs to a work_experience for this user
    const { data: posRow, error: posErr } = await supabase
      .from('positions')
      .select('id, experience_id, work_experiences!inner(user_id)')
      .eq('id', id)
      .eq('work_experiences.user_id', userRow.id)
      .maybeSingle();
    if (posErr) return NextResponse.json({ error: 'Failed to read position' }, { status: 500 });
    const ownerId = (posRow as { work_experiences?: { user_id: string }[] } | null)?.work_experiences?.[0]?.user_id || null;
    if (!posRow || ownerId !== userRow.id) return NextResponse.json({ error: 'Position not found' }, { status: 404 });

    const patch: Partial<{ position: string; description: string | null; start_date: string | null; end_date: string | null }> = {};
    if (typeof body.position === 'string') patch.position = body.position.trim();
    if (typeof body.description !== 'undefined') patch.description = (body.description ?? '').toString().trim() || null;
    if (typeof body.startDate !== 'undefined') {
      const sd = (body.startDate ?? '').toString().trim();
      patch.start_date = sd ? sd : null;
    }
    if (typeof body.endDate !== 'undefined') {
      const ed = (body.endDate ?? '').toString().trim();
      patch.end_date = ed ? ed : null;
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { data: updated, error: updErr } = await supabase
      .from('positions')
      .update(patch)
      .eq('id', id)
      .select('id, experience_id, position, description, start_date, end_date, sort_order')
      .single();
    if (updErr) return NextResponse.json({ error: 'Failed to update position' }, { status: 500 });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Error updating position:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/positions
// Body: { experienceId: string, position: string, description?: string|null, startDate?: string|null, endDate?: string|null }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();
    const { experienceId, position, description, startDate, endDate } = await req.json();

    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    if (!experienceId || !position) return NextResponse.json({ error: 'experienceId and position are required' }, { status: 400 });

    const supabase = await createAuthClient();

    // requester
    const { data: auth } = await supabase.auth.getUser();
    const requesterId = auth?.user?.id || null;
    if (!requesterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // profile owner
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (userError) return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!requesterId || requesterId !== userRow.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // verify experience belongs to this user
    const { data: expRow, error: expErr } = await supabase
      .from('work_experiences')
      .select('id')
      .eq('id', experienceId)
      .eq('user_id', userRow.id)
      .maybeSingle();
    if (expErr) return NextResponse.json({ error: 'Failed to read experience' }, { status: 500 });
    if (!expRow) return NextResponse.json({ error: 'Experience not found' }, { status: 404 });

    // next sort order
    const { data: maxRow } = await supabase
      .from('positions')
      .select('sort_order')
      .eq('experience_id', experienceId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextOrder = typeof maxRow?.sort_order === 'number' ? (maxRow!.sort_order! + 1) : 0;

    const payload = {
      experience_id: experienceId,
      position: String(position).trim(),
      description: (description ?? '').toString().trim() || null,
      start_date: (startDate ?? '').toString().trim() || null,
      end_date: (endDate ?? '').toString().trim() || null,
      sort_order: nextOrder,
    };

    const { data: inserted, error: insErr } = await supabase
      .from('positions')
      .insert(payload)
      .select('id, experience_id, position, description, start_date, end_date, sort_order')
      .single();
    if (insErr) return NextResponse.json({ error: 'Failed to create position', details: insErr.message }, { status: 500 });

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error) {
    console.error('Error creating position:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}