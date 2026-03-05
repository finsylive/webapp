import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

// Base URL for Supabase public assets
const getSupabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || '';

// Try to produce a browser-usable URL for a storage object reference.
// Handles: https URLs, s3:// URLs, Supabase storage paths, bucket/key paths.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    return getSupabaseUrl() ? `${getSupabaseUrl()}/${pathOnly}` : `/${pathOnly}`;
  }
  // Shorthand public path (e.g. 'public/avatars/...')
  if (/^public\//i.test(s)) {
    const pathOnly = s.replace(/^\/+/, '');
    return getSupabaseUrl() ? `${getSupabaseUrl()}/storage/v1/object/${pathOnly}` : `/storage/v1/object/${pathOnly}`;
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
    } catch { }
    if (getSupabaseUrl()) {
      return `${getSupabaseUrl()}/storage/v1/object/public/${path}`;
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
  skills: string[] | null;
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
    const username = (rawUsername || '').trim();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const supabase = await createAuthClient();

    // 1) Fetch user by username (case-insensitive)
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, avatar_url, banner_image, tagline, current_city, user_type, is_verified, about, skills')
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
      skills: u.skills ?? [],
    } as const;

    // 2-5) Fetch ALL supplementary data in parallel for performance
    const isOwnerViewing = viewerId === user.id;

    const [
      followersResult,
      followingResult,
      experiencesResult,
      projectsResult,
      portfoliosResult,
      startupsResult,
      followCheckResult,
      educationResult,
    ] = await Promise.all([
      // Followers count
      (async () => {
        try {
          const r = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('followee_id', user.id);
          return r.count || 0;
        } catch { return 0; }
      })(),
      // Following count
      (async () => {
        try {
          const r = await supabase
            .from('user_follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id);
          return r.count || 0;
        } catch { return 0; }
      })(),
      // Work experiences with nested positions
      (async () => {
        try {
          const r = await supabase
            .from('work_experiences')
            .select(`
              id, user_id, company_name, domain, sort_order,
              positions (id, experience_id, position, start_date, end_date, description, sort_order)
            `)
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })
            .order('sort_order', { ascending: true, foreignTable: 'positions' })
            .order('start_date', { ascending: false, foreignTable: 'positions' })
            .limit(25);
          return r.data || [];
        } catch { return []; }
      })(),
      // Projects count
      (async () => {
        try {
          const r = await supabase
            .from('projects')
            .select('*', { count: 'exact', head: true })
            .eq('owner_id', user.id);
          return r.count || 0;
        } catch { return 0; }
      })(),
      // Portfolios count
      (async () => {
        try {
          const r = await supabase
            .from('portfolios')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);
          return r.count || 0;
        } catch { return 0; }
      })(),
      // Startups
      (async () => {
        try {
          let query = supabase
            .from('startup_profiles')
            .select('id, brand_name, stage, is_actively_raising')
            .eq('owner_id', user.id);
          if (!isOwnerViewing) query = query.eq('is_published', true);
          const { data } = await query.order('created_at', { ascending: false }).limit(10);
          return data || [];
        } catch { return []; }
      })(),
      // Follow check
      (async () => {
        if (!viewerId || viewerId === user.id) return false;
        try {
          const r = await supabase
            .from('user_follows')
            .select('follower_id')
            .eq('follower_id', viewerId)
            .eq('followee_id', user.id)
            .limit(1);
          return !r.error && r.data && r.data.length > 0;
        } catch { return false; }
      })(),
      // Education
      (async () => {
        try {
          const r = await supabase
            .from('education')
            .select('id, institution_name, institution_domain, degree, field_of_study, start_date, end_date, description, sort_order')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })
            .order('start_date', { ascending: false })
            .limit(25);
          return r.data || [];
        } catch { return []; }
      })(),
    ]);

    const followers = followersResult as number;
    const following = followingResult as number;
    const experiences = experiencesResult;
    const projectsCount = projectsResult as number;
    const portfoliosCount = portfoliosResult as number;
    type StartupBrief = { id: string; brand_name: string; stage: string | null; is_actively_raising: boolean | null };
    const startups = startupsResult as StartupBrief[];
    const startupsCount = startups.length;
    const is_following = followCheckResult as boolean;
    type EducationBrief = { id: string; institution_name: string; institution_domain: string | null; degree: string | null; field_of_study: string | null; start_date: string | null; end_date: string | null; description: string | null; sort_order: number | null };
    const education = educationResult as EducationBrief[];

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
        education,
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
