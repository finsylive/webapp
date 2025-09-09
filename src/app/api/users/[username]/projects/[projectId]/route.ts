import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getServerClient() {
  const store = await cookies();
  // Derive the project ref from URL
  const m = /https?:\/\/([^.]+)\.supabase\.co/i.exec(supabaseUrl);
  const ref = m?.[1];
  const cookieName = ref ? `sb-${ref}-auth-token` : undefined;
  let accessToken: string | undefined;
  // Try primary cookie name
  const tryParseToken = (val?: string | null) => {
    if (!val) return undefined;
    let v = val;
    try { v = decodeURIComponent(v); } catch {}
    // Strip surrounding quotes if present
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    try {
      const parsed = JSON.parse(v);
      // handle shapes from helpers
      if (parsed?.access_token) return parsed.access_token as string;
      if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token as string;
      if (Array.isArray(parsed) && parsed[0]) return String(parsed[0]);
    } catch {
      // not JSON; might already be a token
      if (/^[A-Za-z0-9-_.]+$/.test(v)) return v;
    }
    return undefined;
  };
  if (cookieName) {
    accessToken = tryParseToken(store.get(cookieName)?.value);
  }
  // Fallback: find any cookie that looks like an auth token from supabase
  if (!accessToken) {
    for (const c of store.getAll()) {
      if (/-auth-token$/.test(c.name)) {
        accessToken = tryParseToken(c.value);
        if (accessToken) break;
      }
    }
  }
  const client = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: { persistSession: false, detectSessionInUrl: false },
  });
  return { client, accessToken };
}

// GET /api/users/[username]/projects/[projectId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { client: supabase } = await getServerClient();
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
    const { client: supabase, accessToken } = await getServerClient();
    if (!accessToken) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { title, category, tagline, cover_url, logo_url, visibility } = body || {};
    const hasAny = [title, category, tagline, cover_url, logo_url, visibility].some((v) => typeof v !== 'undefined');
    if (!hasAny) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    const normUrl = (u?: string | null) => {
      if (typeof u === 'undefined') return undefined;
      if (!u) return null;
      const t = String(u).trim();
      if (!t) return null;
      if (/^s3:\/\//i.test(t)) return t;
      if (/^https?:\/\//i.test(t)) return t;
      return t;
    };

    const visSet = new Set(['public','private','unlisted']);
    const isUuid = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
    if (typeof title !== 'undefined' && String(title).trim().length === 0) {
      return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 });
    }
    if (typeof category !== 'undefined') {
      if (category === '' || category === null) return NextResponse.json({ error: 'category is required' }, { status: 400 });
      if (!isUuid(category)) return NextResponse.json({ error: 'category must be a valid UUID' }, { status: 400 });
    }
    if (typeof visibility !== 'undefined' && !visSet.has(String(visibility))) {
      return NextResponse.json({ error: 'visibility must be one of public, private, unlisted' }, { status: 400 });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: authUser } = await supabase.auth.getUser();
    const authUserId = authUser?.user?.id;
    if (!authUserId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (authUserId !== userRow.id) return NextResponse.json({ error: 'Forbidden: cannot modify another user\'s project' }, { status: 403 });

    const patch: Record<string, unknown> = {};
    if (typeof title !== 'undefined') patch.title = String(title ?? '').trim();
    if (typeof category !== 'undefined') patch.category = category;
    if (typeof tagline !== 'undefined') patch.tagline = (tagline === '' ? null : String(tagline));
    if (typeof cover_url !== 'undefined') patch.cover_url = normUrl(cover_url);
    if (typeof logo_url !== 'undefined') patch.logo_url = normUrl(logo_url);
    if (typeof visibility !== 'undefined') patch.visibility = visibility;

    const { data: updated, error: updErr } = await supabase
      .from('projects')
      .update(patch)
      .eq('id', projectId)
      .eq('owner_id', authUserId)
      .select('id, owner_id, title, category, tagline, cover_url, logo_url, visibility, created_at')
      .maybeSingle();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
    if (!updated) return NextResponse.json({ error: 'Project not found or not owned by user' }, { status: 404 });
    return NextResponse.json({ data: updated });
  } catch (e) {
    console.error('[project PUT] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/users/[username]/projects/[projectId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ username: string; projectId: string }> }) {
  try {
    const { client: supabase, accessToken } = await getServerClient();
    if (!accessToken) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { username, projectId } = await params;
    if (!username || !projectId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });

    const { data: userRow } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { data: authUserData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authUserData?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const authUserId = authUserData.user.id;
    if (authUserId !== userRow.id) return NextResponse.json({ error: 'Forbidden: cannot delete another user\'s project' }, { status: 403 });

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('owner_id', authUserId);
    if (deleteError) {
      console.warn('[project DELETE] error:', deleteError.message);
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[project DELETE] exception', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
