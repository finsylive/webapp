import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient, createAdminClient } from '@/utils/supabase-server';

export const dynamic = 'force-dynamic';

const VALID_INTERESTS = ['exploring', 'building', 'investing'] as const;

export async function PUT(request: NextRequest) {
  try {
    const authClient = await createAuthClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { primary_interest } = body as { primary_interest: string };

    if (!primary_interest || !VALID_INTERESTS.includes(primary_interest as typeof VALID_INTERESTS[number])) {
      return NextResponse.json(
        { error: 'Invalid interest. Must be one of: exploring, building, investing' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from('users')
      .update({ primary_interest })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating primary interest:', updateError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in interests API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
