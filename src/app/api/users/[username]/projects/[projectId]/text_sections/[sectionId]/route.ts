import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// PUT /api/users/[username]/projects/[projectId]/text_sections/[sectionId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string; sectionId: string }> }) {
  try {
    const { username, projectId, sectionId } = await params;
    if (!username || !projectId || !sectionId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { heading, content, display_order } = body || {};

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
    if (typeof heading !== 'undefined') patch.heading = heading;
    if (typeof content !== 'undefined') patch.content = content;
    if (typeof display_order !== 'undefined') patch.display_order = display_order;

    const { data, error } = await supabase
      .from('project_text_sections')
      .update(patch)
      .eq('id', sectionId)
      .eq('project_id', projectId)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[text_section PUT] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/projects/[projectId]/text_sections/[sectionId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string; sectionId: string }> }) {
  try {
    const { username, projectId, sectionId } = await params;
    if (!username || !projectId || !sectionId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { error } = await supabase
      .from('project_text_sections')
      .delete()
      .eq('id', sectionId)
      .eq('project_id', projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[text_section DELETE] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
