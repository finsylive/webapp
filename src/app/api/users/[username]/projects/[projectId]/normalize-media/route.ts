import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// POST /api/users/[username]/projects/[projectId]/normalize-media
// Normalizes cover_url and logo_url from accidentally saved "https://s3://..." to "s3://..."
export async function POST(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    // Resolve user
    const { data: userRow, error: userErr } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 400 });
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Fetch project
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, cover_url, logo_url')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (projErr) return NextResponse.json({ error: projErr.message }, { status: 400 });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const normalize = (u?: string | null) => {
      if (!u) return u ?? null;
      return u
        .replace(/^https?:\/(?=\/s3:\/\/)/i, '')
        .replace(/^https?:\/\/s3:\/\//i, 's3://');
    };

    const newCover = normalize(project.cover_url || undefined);
    const newLogo = normalize(project.logo_url || undefined);

    const patch: Record<string, string | null | undefined> = {};
    if (newCover !== project.cover_url) patch.cover_url = newCover || null;
    if (newLogo !== project.logo_url) patch.logo_url = newLogo || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: true, updated: false });
    }

    const { error: updErr } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .eq('owner_id', userRow.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, updated: true, patch });
  } catch (e: unknown) {
    console.error('[projects normalize-media POST] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
