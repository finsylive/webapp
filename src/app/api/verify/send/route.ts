import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, createAuthClient } from '@/utils/supabase-server';

// POST /api/verify/send
// Generates a 6-digit verification code, stores it, and sends via Edge Function
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user via cookie-based client
    const authClient = await createAuthClient();
    const { data: auth } = await authClient.auth.getUser();
    const userId = auth?.user?.id;
    const email = auth?.user?.email;

    if (!userId || !email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for DB operations
    const supabase = createAdminClient();

    // Check if already verified
    const { data: userRow } = await supabase
      .from('users')
      .select('is_verified')
      .eq('id', userId)
      .maybeSingle();

    if (userRow?.is_verified) {
      return NextResponse.json({ error: 'Already verified' }, { status: 400 });
    }

    // Rate limit: max 3 per hour per user
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('verification_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= 3) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Store verification code
    const { error: insertErr } = await supabase
      .from('verification_codes')
      .insert({
        user_id: userId,
        code,
        expires_at: expiresAt,
      });

    if (insertErr) {
      console.error('[verify/send] insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to create verification code' }, { status: 500 });
    }

    // Send email via Supabase Edge Function
    try {
      await supabase.functions.invoke('send-verification-email', {
        body: { email, code, userId },
      });
    } catch (edgeErr) {
      console.warn('[verify/send] Edge function failed, code still stored:', edgeErr);
      // Don't fail the request - the code is stored and can be retrieved
    }

    return NextResponse.json({ success: true, message: 'Verification code sent' });
  } catch (e) {
    console.error('[verify/send] unexpected error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
