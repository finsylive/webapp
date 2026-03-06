import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['explorer', 'investor', 'founder'] as const;
type UserRole = typeof VALID_ROLES[number];

export async function POST(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { user_type } = body as { user_type: UserRole };

    if (!user_type || !VALID_ROLES.includes(user_type)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: explorer, investor, founder' },
        { status: 400 }
      );
    }

    const admin = await createAuthClient();

    const { error: updateError } = await admin
      .from('users')
      .update({
        user_type,
        is_onboarding_done: true,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user onboarding:', updateError);
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // Return redirect path based on role
    const redirectMap: Record<UserRole, string> = {
      explorer: '/',
      investor: '/startups',
      founder: '/startups/my',
    };

    return NextResponse.json({
      success: true,
      redirect: redirectMap[user_type],
    });
  } catch (error) {
    console.error('Error in onboarding API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
