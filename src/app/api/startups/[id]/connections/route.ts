import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const VALID_FACILITATOR_RELATIONS = new Set([
  'supported',
  'incubated',
  'accelerated',
  'partnered',
  'mentored',
  'funded',
  'community_member',
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: startupId } = await params;
    const body = await request.json();
    const organizationSlug = String(body.organization_slug || '');
    const relationType = String(body.relation_type || '');

    if (!organizationSlug || !relationType) {
      return NextResponse.json({ error: 'organization_slug and relation_type are required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: startup, error: startupError } = await admin
      .from('startup_profiles')
      .select('id, owner_id, entity_type')
      .eq('id', startupId)
      .maybeSingle();

    if (startupError) {
      return NextResponse.json({ error: startupError.message }, { status: 500 });
    }
    if (!startup) {
      return NextResponse.json({ error: 'Startup not found' }, { status: 404 });
    }
    if (startup.owner_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: organization } = await admin
      .from('organizations')
      .select('id, slug, org_type, name')
      .eq('slug', organizationSlug)
      .maybeSingle();

    if (organization) {
      if (organization.org_type !== 'club') {
        return NextResponse.json({ error: 'Only organization profiles like clubs can be attached to org projects' }, { status: 400 });
      }
      if (startup.entity_type !== 'org_project') {
        return NextResponse.json({ error: 'Only org projects can be linked to organizations' }, { status: 400 });
      }
      if (relationType !== 'club_project') {
        return NextResponse.json({ error: 'Invalid organization relation type' }, { status: 400 });
      }

      const now = new Date().toISOString();
      const { data: relation, error } = await admin
        .from('organization_startup_relations')
        .upsert({
          organization_id: organization.id,
          startup_id: startup.id,
          relation_type: 'club_project',
          status: 'accepted',
          requested_by_user_id: user.id,
          requested_at: now,
          responded_by_user_id: user.id,
          responded_at: now,
          updated_at: now,
        }, { onConflict: 'organization_id,startup_id' })
        .select('id, status')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data: relation });
    }

    const { data: facilitator } = await admin
      .from('facilitator_profiles')
      .select('id, slug, organisation_name')
      .eq('slug', organizationSlug)
      .maybeSingle();

    if (!facilitator) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }
    if (startup.entity_type !== 'startup') {
      return NextResponse.json({ error: 'Only startups can be linked to startup facilitators' }, { status: 400 });
    }
    if (!VALID_FACILITATOR_RELATIONS.has(relationType)) {
      return NextResponse.json({ error: 'Invalid startup facilitator relation type' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: relation, error } = await admin
      .from('startup_facilitator_assignments')
      .upsert({
        startup_id: startup.id,
        facilitator_id: facilitator.id,
        status: 'approved',
        assigned_by: facilitator.id,
        relation_type: relationType,
        reviewed_at: now,
        updated_at: now,
      }, { onConflict: 'startup_id,facilitator_id' })
      .select('id, status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: relation });
  } catch (error) {
    console.error('Error connecting startup to organization:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
