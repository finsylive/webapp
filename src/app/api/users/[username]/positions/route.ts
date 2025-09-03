// positions api 
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type Position = {
  id: string;
  experience_id: string;
  position: string; // Changed from 'title' to 'position' to match schema
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  sort_order: number;
  work_experiences: { // Changed from 'work_experience' to match Supabase naming
    id: string;
    company: string | null;
    company_name: string | null;
    role: string | null;
    user_id: string;
  };
};

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

    // Create an authenticated Supabase client bound to cookies (so RLS applies)
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // First, get the user ID from username
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (userError) {
      console.warn('[positions API] error fetching user:', userError.message);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch positions with work experience data (inner join ensures only user's experiences)
    const { data: positions, error: positionsError } = await supabase
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
      .order('start_date', { ascending: false, nullsFirst: false });

    if (positionsError) {
      console.error('[positions API] error fetching positions:', positionsError);
      return NextResponse.json({ error: 'Failed to fetch positions', details: positionsError.message }, { status: 500 });
    }

    // Transform the data to match expected format (keeping backward compatibility)
    const formattedPositions = (positions || []).map((position: any) => ({
      id: position.id,
      experience_id: position.experience_id,
      title: position.position, // Map 'position' field to 'title' for backward compatibility
      position: position.position, // Also include the actual field name
      start_date: position.start_date,
      end_date: position.end_date,
      description: position.description,
      sort_order: position.sort_order,
      work_experience: position.work_experiences // Map to singular for backward compatibility
    }));

    return NextResponse.json({
      data: formattedPositions,
      count: formattedPositions.length
    });

  } catch (error) {
    console.error('Error in positions API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}