import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';

// Base URL for Supabase public assets
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Try to produce a browser-usable URL for a storage object reference.
// Strategy:
// 1) If already https, return as-is.
// 2) If looks like "bucket/path/to.obj", try to create a signed URL (works for public or private buckets).
// 3) Fallback to public URL pattern using NEXT_PUBLIC_SUPABASE_URL.
async function toUsableUrl(u: string | null | undefined, supabase: any): Promise<string | null> {
  if (!u) return null;
  const s = u.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  // If it's already a storage public path, prefix with base URL
  if (/^\/?storage\/v1\/object\/public\//i.test(s) || /^\/storage\/v1\/object\/public\//i.test(s)) {
    const pathOnly = s.replace(/^\/+/, '');
    return supabaseUrl ? `${supabaseUrl}/${pathOnly}` : `/${pathOnly}`;
  }
  // If it's like 'public/avatars/...' treat as storage object public path
  if (/^public\//i.test(s)) {
    const pathOnly = s.replace(/^\/+/, '');
    return supabaseUrl ? `${supabaseUrl}/storage/v1/object/${pathOnly}` : `/storage/v1/object/${pathOnly}`;
  }
  // Do not return s3:// to clients; generate a signed URL if possible.
  const path = s.replace(/^\/+/, ''); // normalize leading slash
  const firstSlash = path.indexOf('/');
  if (firstSlash > 0) {
    const bucket = path.slice(0, firstSlash);
    const key = path.slice(firstSlash + 1);
    try {
      const { data, error } = await (supabase as any).storage.from(bucket).createSignedUrl(key, 60 * 60);
      if (!error && data?.signedUrl) return data.signedUrl as string;
    } catch {}
    // Fallback to public URL pattern
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/${path}`;
    }
  }
  return null;
}

type UserRow = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  banner_image: string | null;
  tagline: string | null;
  current_city: string | null;
  user_type: string | null;
  is_verified: boolean | null;
  about: string | null;
};

// GET /api/users/[username]/profile?viewerId=...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get('viewerId');
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim().toLowerCase();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Bind Supabase to cookies so RLS applies
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // 1) Fetch user by username (exact, case-sensitive match as stored)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, user_type, is_verified, about')
      .eq('username', username)
      .maybeSingle();

    if (userError) {
      console.warn('[profile API] error fetching user:', userError.message);
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Normalize user payload to expose `bio` expected by client
    const u = userRow as UserRow;
    const avatar_url = await toUsableUrl(u.avatar_url, supabase);
    const banner_image = await toUsableUrl(u.banner_image, supabase);
    const user = {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      avatar_url,
      // new field
      banner_image: banner_image ?? null,
      // legacy alias kept for backward compatibility
      cover_url: banner_image ?? null,
      tagline: u.tagline,
      current_city: u.current_city,
      user_type: u.user_type,
      is_verified: u.is_verified,
      // new field
      about: u.about ?? null,
      // legacy alias kept for backward compatibility
      bio: u.about ?? null,
    } as const;

    // 2) Followers/Following counts (graceful if table missing)
    let followers = 0;
    let following = 0;
    try {
      const { count: followersCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', user.id);

      const { count: followingCount } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', user.id);

      followers = followersCount || 0;
      following = followingCount || 0;
    } catch {
      // Ignore missing table or permission errors; keep zeros
      followers = 0;
      following = 0;
    }

    // 3) Work experiences with nested positions
    type PositionRow = {
      id: string;
      experience_id: string;
      position: string;
      start_date: string | null;
      end_date: string | null;
      description: string | null;
      sort_order: number | null;
    };
    type ExperienceRow = {
      id: string;
      user_id: string;
      company_name: string;
      domain: string | null;
      sort_order: number | null;
      positions: PositionRow[];
    };
    let experiences: ExperienceRow[] = [];
    try {
      const { data, error } = await supabase
        .from('work_experiences')
        .select(`
          id,
          user_id,
          company_name,
          domain,
          sort_order,
          positions (
            id,
            experience_id,
            position,
            start_date,
            end_date,
            description,
            sort_order
          )
        `)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })
        .order('sort_order', { ascending: true, foreignTable: 'positions' })
        .order('start_date', { ascending: false, foreignTable: 'positions' })
        .limit(25);
      if (error) {
        console.warn('[profile API] error fetching experiences:', error.message);
        experiences = [];
      } else {
        experiences = (data as any) || [];
      }
    } catch {
      experiences = [];
    }

    // 4) Projects and portfolios (counts only here)
    let projectsCount = 0;
    let portfoliosCount = 0;
    try {
      const { count: pCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('owner_id', user.id);
      projectsCount = pCount || 0;
    } catch {
      projectsCount = 0;
    }

    try {
      const { count: pfCount } = await supabase
        .from('portfolios')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      portfoliosCount = pfCount || 0;
    } catch {
      portfoliosCount = 0;
    }

    // 5) Whether the viewer follows this user
    let is_following = false;
    if (viewerId && viewerId !== user.id) {
      try {
        const { data, error } = await supabase
          .from('user_follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('followee_id', user.id)
          .limit(1);
        if (!error && data && data.length > 0) {
          is_following = true;
        }
      } catch {
        is_following = false;
      }
    }

    return NextResponse.json({
      data: {
        user,
        counts: {
          followers,
          following,
          projects: projectsCount,
          portfolios: portfoliosCount,
        },
        experiences,
        viewer: {
          is_following,
        },
      },
    });
  } catch (error) {
    console.error('Error in profile API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
