import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const VALID_INTERESTS = ['exploring', 'building', 'investing', 'hiring'] as const;
type Interest = typeof VALID_INTERESTS[number];

const INTEREST_TO_PRIMARY: Record<Interest, string> = {
  exploring: 'exploring',
  building: 'building',
  investing: 'investing',
  hiring: 'exploring',
};

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { interests } = body as { interests: string[] };

    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return NextResponse.json(
        { error: 'Select at least one interest' },
        { status: 400 }
      );
    }

    const validInterests = interests.filter((i): i is Interest =>
      VALID_INTERESTS.includes(i as Interest)
    );

    if (validInterests.length === 0) {
      return NextResponse.json(
        { error: 'Invalid interests provided' },
        { status: 400 }
      );
    }

    const primaryInterest = INTEREST_TO_PRIMARY[validInterests[0]];

    const admin = createAdminClient();

    // Try with new columns first, fall back to base columns if PostgREST
    // schema cache hasn't picked up the migration yet
    const { error: updateError } = await admin
      .from('users')
      .update({
        user_type: 'normal_user',
        primary_interest: primaryInterest,
        is_onboarding_done: true,
      })
      .eq('id', user.id);

    if (updateError && (updateError.code === 'PGRST204' || updateError.message?.includes('does not exist') || updateError.message?.includes('schema cache'))) {
      // Schema cache stale or columns not visible — fall back to base columns only
      const { error: fallbackError } = await admin
        .from('users')
        .update({
          user_type: 'normal_user',
          is_onboarding_done: true,
        })
        .eq('id', user.id);

      if (fallbackError) {
        console.error('Error updating user onboarding (fallback):', fallbackError);
        return NextResponse.json({ error: `Failed to update user: ${fallbackError.message}` }, { status: 500 });
      }
    } else if (updateError) {
      console.error('Error updating user onboarding:', updateError);
      return NextResponse.json({ error: `Failed to update user: ${updateError.message} (code: ${updateError.code})` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      redirect: '/',
    });
  } catch (error) {
    console.error('Error in onboarding API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
