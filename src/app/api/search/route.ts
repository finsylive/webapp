import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// Escape special PostgREST filter characters in user input
function sanitizePattern(input: string): string {
  return input.replace(/[%_\\().,*]/g, '\\$&');
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';
    const type = searchParams.get('type') || 'users';

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const safe = sanitizePattern(query);
    const pattern = `%${safe}%`;

    if (type === 'users') {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, full_name, avatar_url, tagline, current_city, user_type, is_verified')
        .or(`username.ilike.${pattern},full_name.ilike.${pattern},tagline.ilike.${pattern}`)
        .order('is_verified', { ascending: false })
        .order('full_name', { ascending: true })
        .limit(25);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    if (type === 'posts') {
      const { data, error } = await supabase
        .from('posts')
        .select('id, content, created_at, user_id, users(username, full_name, avatar_url)')
        .ilike('content', pattern)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    if (type === 'competitions') {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, title, description, start_date, end_date, banner_url, prize, created_at')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    if (type === 'jobs') {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, company, description, location, job_type, salary_range, is_active, created_at')
        .eq('is_active', true)
        .or(`title.ilike.${pattern},company.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    if (type === 'gigs') {
      const { data, error } = await supabase
        .from('gigs')
        .select('id, title, description, budget, deadline, is_active, created_at')
        .eq('is_active', true)
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: data || [] });
    }

    return NextResponse.json({ error: 'Invalid search type' }, { status: 400 });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
