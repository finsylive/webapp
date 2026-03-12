import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set(['owner', 'admin']);

function normalizeLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const body = await request.json();
    const officialEmail = String(body.official_email || '').trim();
    const roleTitle = String(body.role_title || '').trim();
    const proofSummary = String(body.proof_summary || '').trim();
    const evidenceLinks = normalizeLinks(body.evidence_links);

    if (!officialEmail) {
      return NextResponse.json({ error: 'Official email is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: organization, error: orgError } = await admin
      .from('organizations')
      .select('id, verification_status')
      .eq('slug', slug)
      .maybeSingle();

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 500 });
    }
    if (!organization) {
      return NextResponse.json({ error: 'Startup facilitator not found' }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }
    if (!membership?.role || !ALLOWED_ROLES.has(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (organization.verification_status === 'verified') {
      return NextResponse.json({ error: 'Startup facilitator is already verified' }, { status: 400 });
    }
    if (organization.verification_status === 'pending_review') {
      return NextResponse.json({ error: 'Verification request already pending' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const verificationDetails = {
      official_email: officialEmail,
      role_title: roleTitle || null,
      evidence_links: evidenceLinks,
      proof_summary: proofSummary || null,
    };

    const { data, error } = await admin
      .from('organizations')
      .update({
        verification_status: 'pending_review',
        verification_requested_at: now,
        verification_submitted_by: user.id,
        verification_reviewed_at: null,
        verification_rejection_reason: null,
        verification_details: verificationDetails,
      })
      .eq('id', organization.id)
      .select('verification_status, verification_requested_at, verification_reviewed_at, verification_rejection_reason, verification_details, is_verified')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error applying for facilitator verification:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
