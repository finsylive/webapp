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

    // Check if user has already completed onboarding — prevent role change via back button
    const { data: existingUser } = await authClient
      .from('users')
      .select('is_onboarding_done')
      .eq('id', user.id)
      .single();

    if (existingUser?.is_onboarding_done) {
      return NextResponse.json(
        { error: 'Onboarding already completed' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { user_type, username } = body as { user_type: UserRole; username?: string };

    if (!user_type || !VALID_ROLES.includes(user_type)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be one of: explorer, investor, founder' },
        { status: 400 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      user_type,
      is_onboarding_done: true,
    };

    // Validate and set username if provided
    if (username) {
      const trimmed = username.trim().toLowerCase();

      if (trimmed.length < 3 || trimmed.length > 20) {
        return NextResponse.json(
          { error: 'Username must be between 3 and 20 characters' },
          { status: 400 }
        );
      }

      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Username can only contain letters, numbers, and underscores' },
          { status: 400 }
        );
      }

      // Check uniqueness (exclude current user)
      const { data: taken } = await authClient
        .from('users')
        .select('id')
        .eq('username', trimmed)
        .neq('id', user.id)
        .single();

      if (taken) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 }
        );
      }

      updatePayload.username = trimmed;
    }

    const { error: updateError } = await authClient
      .from('users')
      .update(updatePayload)
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
