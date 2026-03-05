import { NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// Escape special PostgREST filter characters in user input
function sanitizePattern(input: string): string {
  return input.replace(/[%_\\().,*]/g, '\\$&');
}

export async function GET(request: Request) {
  try {
    const supabase = await createAuthClient();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const safe = sanitizePattern(query);
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, tagline, current_city, user_type, is_verified')
      .or(`username.ilike.%${safe}%,full_name.ilike.%${safe}%,tagline.ilike.%${safe}%`)
      .order('is_verified', { ascending: false })
      .order('full_name', { ascending: true })
      .limit(25);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch users' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
