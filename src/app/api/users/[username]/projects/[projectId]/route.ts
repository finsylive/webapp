import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/users/[username]/projects/[projectId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .maybeSingle();
    if (error) {
      console.warn('[project GET] error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ data: project });
  } catch (e) {
    console.error('[project GET] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/users/[username]/projects/[projectId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { title, category, tagline, cover_url, logo_url, visibility } = body || {};
    const hasAny = [title, category, tagline, cover_url, logo_url, visibility].some((v) => typeof v !== 'undefined');
    if (!hasAny) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    const normUrl = (u?: string | null) => {
      if (typeof u === 'undefined') return undefined as any;
      if (!u) return null;
      const t = String(u).trim();
      if (!t) return null;
      return /^https?:\/\//i.test(t) ? t : `https://${t}`;
    };

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const patch: any = {};
    if (typeof title !== 'undefined') patch.title = title;
    if (typeof category !== 'undefined') patch.category = category;
    if (typeof tagline !== 'undefined') patch.tagline = tagline;
    if (typeof cover_url !== 'undefined') patch.cover_url = normUrl(cover_url);
    if (typeof logo_url !== 'undefined') patch.logo_url = normUrl(logo_url);
    if (typeof visibility !== 'undefined') patch.visibility = visibility;

    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .eq('owner_id', userRow.id)
      .select('*')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[project PUT] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/projects/[projectId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', userRow.id);
    if (error) {
      console.warn('[project DELETE] error:', error.message);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[project DELETE] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
