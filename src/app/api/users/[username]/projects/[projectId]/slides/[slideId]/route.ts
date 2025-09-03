import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// PUT /api/users/[username]/projects/[projectId]/slides/[slideId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string; slideId: string }> }) {
  try {
    const { username, projectId, slideId } = await params;
    if (!username || !projectId || !slideId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { slide_url, caption, slide_number } = body || {};

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const patch: any = {};
    if (typeof slide_url !== 'undefined') patch.slide_url = /^https?:\/\//i.test(String(slide_url)) ? String(slide_url) : `https://${String(slide_url)}`;
    if (typeof caption !== 'undefined') patch.caption = caption;
    if (typeof slide_number !== 'undefined') patch.slide_number = slide_number;

    const { data, error } = await supabase
      .from('project_slides')
      .update(patch)
      .eq('id', slideId)
      .eq('project_id', projectId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[slide PUT] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/projects/[projectId]/slides/[slideId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string; slideId: string }> }) {
  try {
    const { username, projectId, slideId } = await params;
    if (!username || !projectId || !slideId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { error } = await supabase
      .from('project_slides')
      .delete()
      .eq('id', slideId)
      .eq('project_id', projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[slide DELETE] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
