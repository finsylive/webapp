import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const VALID_INVESTOR_TYPES = [
  'angel', 'vc', 'scout', 'syndicate_lead',
  'family_office', 'accelerator', 'corporate_vc', 'government',
] as const;

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      investor_type,
      firm_name,
      affiliated_fund,
      check_size_min,
      check_size_max,
      preferred_stages,
      preferred_sectors,
      linkedin,
      website,
      thesis,
      location,
    } = body;

    if (!investor_type || !VALID_INVESTOR_TYPES.includes(investor_type)) {
      return NextResponse.json(
        { error: 'Invalid investor type' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check if user already applied
    const { data: existing } = await admin
      .from('users')
      .select('investor_status')
      .eq('id', user.id)
      .single();

    if (existing?.investor_status === 'verified') {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 });
    }

    if (existing?.investor_status === 'applied') {
      return NextResponse.json({ error: 'Application already pending' }, { status: 400 });
    }

    // Upsert investor_profiles row
    const { error: profileError } = await admin
      .from('investor_profiles')
      .upsert({
        user_id: user.id,
        investor_type,
        firm_name: firm_name || null,
        affiliated_fund: affiliated_fund || null,
        check_size_min: check_size_min || null,
        check_size_max: check_size_max || null,
        preferred_stages: preferred_stages || [],
        preferred_sectors: preferred_sectors || [],
        linkedin: linkedin || null,
        website: website || null,
        thesis: thesis || null,
        location: location || null,
        is_actively_investing: true,
      }, { onConflict: 'user_id' });

    if (profileError) {
      console.error('Error creating investor profile:', profileError);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    // Update user status to 'applied'
    const { error: userError } = await admin
      .from('users')
      .update({
        investor_status: 'applied',
        linkedin: linkedin || null,
      })
      .eq('id', user.id);

    if (userError) {
      console.error('Error updating user investor status:', userError);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: 'applied' });
  } catch (error) {
    console.error('Error in investor apply API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
