import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Base URL for Supabase public assets
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Try to produce a browser-usable URL for a storage object reference.
// Handles: https URLs, s3:// URLs, Supabase storage paths, bucket/key paths.
async function toUsableUrl(u: string | null | undefined, supabase: SupabaseClient): Promise<string | null> {
  if (!u) return null;
  const s = u.trim();
  if (!s) return null;
  // Already a valid HTTP(S) URL — use as-is
  if (/^https?:\/\//i.test(s)) return s;
  // S3 protocol URLs: s3://bucket-name/path → https://bucket-name.s3.amazonaws.com/path
  const s3Match = s.match(/^s3:\/\/([^/]+)\/(.+)$/i);
  if (s3Match) {
    const [, bucket, key] = s3Match;
    return `https://${bucket}.s3.amazonaws.com/${key}`;
  }
  // Supabase storage public path
  if (/^\/?storage\/v1\/object\/public\//i.test(s)) {
    const pathOnly = s.replace(/^\/+/, '');
    return supabaseUrl ? `${supabaseUrl}/${pathOnly}` : `/${pathOnly}`;
  }
  // Shorthand public path (e.g. 'public/avatars/...')
  if (/^public\//i.test(s)) {
    const pathOnly = s.replace(/^\/+/, '');
    return supabaseUrl ? `${supabaseUrl}/storage/v1/object/${pathOnly}` : `/storage/v1/object/${pathOnly}`;
  }
  // Bucket/key path — try signed URL, fallback to public URL pattern
  const path = s.replace(/^\/+/, '');
  const firstSlash = path.indexOf('/');
  if (firstSlash > 0) {
    const bucket = path.slice(0, firstSlash);
    const key = path.slice(firstSlash + 1);
    try {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(key, 60 * 60);
      if (!error && data?.signedUrl) return data.signedUrl as string;
    } catch {}
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

export const dynamic = 'force-dynamic';

// GET /api/users/[username]/profile?viewerId=...
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const viewerId = searchParams.get('viewerId');
    const { username: rawUsername } = await params;
    const username = (rawUsername || '').trim();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1) Fetch user by username (case-insensitive)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, user_type, is_verified, about')
      .ilike('username', username)
      .maybeSingle();

    if (userError) {
      console.warn('[profile API] error fetching user:', userError.message);
    }

    if (!userRow) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Normalize user payload to expose `bio` expected by client
    const u = userRow as UserRow;
    // Return raw URLs — the frontend uses toProxyUrl() to route through the
    // Supabase get-image edge function which has backend S3 access.
    const avatar_url = u.avatar_url?.trim() || null;
    const banner_image = u.banner_image?.trim() || null;
    const user = {
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      avatar_url,
      banner_image: banner_image ?? null,
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
        experiences = (data as ExperienceRow[]) || [];
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

    // 4c) Startups owned by this user
    // Show all startups (including unpublished) if the viewer is the owner
    type StartupBrief = { id: string; brand_name: string; stage: string | null; is_actively_raising: boolean | null };
    let startups: StartupBrief[] = [];
    let startupsCount = 0;
    try {
      const isOwnerViewing = viewerId === user.id;
      let query = supabase
        .from('startup_profiles')
        .select('id, brand_name, stage, is_actively_raising')
        .eq('owner_id', user.id);
      if (!isOwnerViewing) {
        query = query.eq('is_published', true);
      }
      const { data: sData, error: sErr } = await query
        .order('created_at', { ascending: false })
        .limit(10);
      if (!sErr && sData) {
        startups = sData as StartupBrief[];
        startupsCount = sData.length;
      }
    } catch {
      startups = [];
      startupsCount = 0;
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
          startups: startupsCount,
        },
        experiences,
        startups,
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
