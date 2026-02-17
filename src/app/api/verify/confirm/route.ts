import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';

// POST /api/verify/confirm
// Body: { code: string }
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user via cookie-based client
    const authClient = await createAuthClient();
    const { data: auth } = await authClient.auth.getUser();
    const userId = auth?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    // Use admin client for DB operations
    const supabase = createAdminClient();

    // Find valid, unused code for this user
    const now = new Date().toISOString();
    const { data: codeRow, error: fetchErr } = await supabase
      .from('verification_codes')
      .select('id, code, expires_at, used')
      .eq('user_id', userId)
      .eq('code', code)
      .eq('used', false)
      .gte('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchErr) {
      console.error('[verify/confirm] fetch error:', fetchErr);
      return NextResponse.json({ error: 'Failed to verify' }, { status: 500 });
    }

    if (!codeRow) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    // Mark code as used
    await supabase
      .from('verification_codes')
      .update({ used: true })
      .eq('id', codeRow.id);

    // Set user as verified
    const { error: updateErr } = await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('id', userId);

    if (updateErr) {
      console.error('[verify/confirm] update user error:', updateErr);
      return NextResponse.json({ error: 'Failed to update verification status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Profile verified' });
  } catch (e) {
    console.error('[verify/confirm] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
