import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';
import { slugify } from '@/utils/slug';

export const dynamic = 'force-dynamic';

const VALID_ORG_TYPES = new Set([
  'incubator',
  'accelerator',
  'ecell',
  'college_incubator',
  'facilitator',
  'venture_studio',
  'grant_body',
  'community',
  'other',
]);

async function getUniqueSlug(admin: ReturnType<typeof createAdminClient>, baseName: string) {
  const base = slugify(baseName);

  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await admin.from('organizations').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }

  return `${base}-${Date.now().toString().slice(-6)}`;
}

export async function GET(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const mine = searchParams.get('mine') === 'true';
    const search = searchParams.get('search');
    const orgType = searchParams.get('org_type');

    if (mine && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = admin
      .from('organizations')
      .select('id, slug, name, org_type, short_bio, website, logo_url, city, state, country, is_verified, verification_status, is_published, sectors, support_types, created_at')
      .order('created_at', { ascending: false });

    if (mine && user) {
      const { data: memberships, error: membershipError } = await admin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (membershipError) {
        return NextResponse.json({ error: membershipError.message }, { status: 500 });
      }

      const orgIds = (memberships || []).map((row) => row.organization_id);
      if (orgIds.length === 0) {
        return NextResponse.json({ data: [] });
      }
      query = query.in('id', orgIds);
    } else {
      query = query.eq('is_published', true);
    }

    if (orgType && VALID_ORG_TYPES.has(orgType)) {
      query = query.eq('org_type', orgType);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,short_bio.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = String(body.name || '').trim();
    const orgType = String(body.org_type || '');

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }
    if (!VALID_ORG_TYPES.has(orgType)) {
      return NextResponse.json({ error: 'Invalid organization type' }, { status: 400 });
    }

    const admin = createAdminClient();
    const slug = await getUniqueSlug(admin, name);

    const payload = {
      slug,
      name,
      org_type: orgType,
      short_bio: body.short_bio?.trim() || null,
      description: body.description?.trim() || null,
      website: body.website?.trim() || null,
      contact_email: body.contact_email?.trim() || null,
      logo_url: body.logo_url?.trim() || null,
      banner_url: body.banner_url?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      country: body.country?.trim() || null,
      university_name: body.university_name?.trim() || null,
      sectors: Array.isArray(body.sectors) ? body.sectors.filter(Boolean) : [],
      stage_focus: Array.isArray(body.stage_focus) ? body.stage_focus.filter(Boolean) : [],
      support_types: Array.isArray(body.support_types) ? body.support_types.filter(Boolean) : [],
      is_published: Boolean(body.is_published),
      created_by: user.id,
    };

    const { data: organization, error: insertError } = await admin
      .from('organizations')
      .insert(payload)
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { error: memberError } = await admin
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      });

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        ...organization,
        is_admin: true,
        member_role: 'owner',
        relations: [],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
