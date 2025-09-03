import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/users/[username]/projects/[projectId]/slides
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('project_slides')
      .select('*')
      .eq('project_id', projectId)
      .order('slide_number', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data: data || [] });
  } catch (e) {
    console.error('[slides GET] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/[username]/projects/[projectId]/slides
// Body: { slide_url: string, caption?: string, slide_number: number }
export async function POST(req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { slide_url, caption = null, slide_number } = body || {};
    if (!slide_url || typeof slide_number !== 'number') {
      return NextResponse.json({ error: 'slide_url and slide_number are required' }, { status: 400 });
    }

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

    const insert = { project_id: projectId, slide_url: normUrl(String(slide_url).trim()), caption, slide_number } as const;
    const { data, error } = await supabase.from('project_slides').insert(insert).select('*').maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[slides POST] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
