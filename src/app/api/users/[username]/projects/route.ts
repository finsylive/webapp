import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

// GET /api/users/[username]/projects
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    // resolve user id
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();

    if (userError) console.warn('[projects API] user fetch error:', userError.message);
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // fetch projects owned by user
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('owner_id', userRow.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (projError) {
      console.warn('[projects API] projects fetch error:', projError.message);
      return NextResponse.json({ data: [] });
    }
    return NextResponse.json({ data: projects || [] });
  } catch (e) {
    console.error('Error in projects API:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/projects
// Body: { title: string, category: string(uuid), tagline?: string, cover_url?: string, logo_url?: string, visibility?: 'public'|'private'|'unlisted' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string }> }) {
  try {
    const supabase = await createAuthClient();
    const { username } = await params;
    if (!username) return NextResponse.json({ error: 'Username is required' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { title, category, tagline = null, cover_url = null, logo_url = null, visibility = 'public' } = body || {};
    if (!title || !category) {
      return NextResponse.json({ error: 'title and category are required' }, { status: 400 });
    }

    const normUrl = (u?: string | null) => {
      if (!u) return null;
      const t = String(u).trim();
      if (!t) return null;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    };

    // resolve user id
    const { data: userRow } = await supabase
      .from('users')
      .select('id, username')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const insert = {
      owner_id: userRow.id,
      title,
      category,
      tagline,
      cover_url: normUrl(cover_url),
      logo_url: normUrl(logo_url),
      visibility,
    } as const;

    const { data, error } = await supabase.from('projects').insert(insert).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('Error creating project:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
