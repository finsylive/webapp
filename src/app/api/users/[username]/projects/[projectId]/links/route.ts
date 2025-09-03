import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/users/[username]/projects/[projectId]/links
// Returns ordered list of links for project
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Ensure project belongs to user
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('project_links')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    console.error('[links GET] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/projects/[projectId]/links
// Body: { title: string, url: string, icon_name?: string, display_order?: number }
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { title, url, icon_name = null, display_order = 0 } = body || {};
    if (!title || !url) return NextResponse.json({ error: 'title and url are required' }, { status: 400 });

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const normUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

    const insert = { project_id: projectId, title, url: normUrl(String(url).trim()), icon_name, display_order } as const;
    const { data, error } = await supabase.from('project_links').insert(insert).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[links POST] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
