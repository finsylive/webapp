import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/users/[username]/projects/[projectId]/slides/normalize
// Normalizes stored slide_url values from mistakenly saved "https://s3://..." to "s3://..."
export async function POST(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    // Resolve user -> project ownership
    const { data: userRow, error: userErr } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 400 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (projErr) return NextResponse.json({ error: projErr.message }, { status: 400 });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    // Fetch slides
    const { data: slides, error: listErr } = await supabase
      .from('project_slides')
      .select('id, slide_url, slide_number')
      .eq('project_id', projectId)
      .order('slide_number', { ascending: true });
    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 400 });

    const normalize = (u: string): string => u
      .replace(/^https?:\/\/(?=s3:\/\/)/i, '') // remove leading http(s):// only when immediately followed by s3://
      .replace(/^https?:\/\/s3:\/\//i, 's3://'); // extra safety

    const updates = (slides || [])
      .filter((s) => typeof s.slide_url === 'string' && /^(https?:\/\/)?s3:\/\//i.test(s.slide_url))
      .map(async (s) => {
        const clean = normalize(s.slide_url as string);
        if (clean === s.slide_url) return null;
        const { error } = await supabase
          .from('project_slides')
          .update({ slide_url: clean })
          .eq('id', s.id);
        if (error) throw error;
        return { id: s.id, from: s.slide_url, to: clean };
      });

    const results = await Promise.all(updates);
    const changed = results.filter(Boolean);

    return NextResponse.json({ ok: true, updated: changed }, { status: 200 });
  } catch (e: any) {
    console.error('[slides normalize POST] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
