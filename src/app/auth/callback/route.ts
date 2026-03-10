import { createAuthClient } from '@/utils/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';



export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  console.log('[AUTH CALLBACK] Hit callback route');
  console.log('[AUTH CALLBACK] Code present:', !!code, '| Error:', error, '| Desc:', errorDescription);

  // Handle errors returned by Supabase (e.g. failed external code exchange)
  if (error) {
    console.error('[AUTH CALLBACK] Supabase returned error:', error, errorDescription);
    return NextResponse.redirect(`${requestUrl.origin}/?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription || '')}`);
  }

  if (code) {
    // Next.js 16: cookies() is async, must await before passing
    const supabase = await createAuthClient();

    // Exchange code for session
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    console.log('[AUTH CALLBACK] Exchange result - session:', !!session, 'error:', sessionError?.message);

    if (sessionError) {
      console.error('Error exchanging code for session:', sessionError);
      return NextResponse.redirect(`${requestUrl.origin}/?error=auth_failed`);
    }

    if (session?.user) {
      // Use service role client to bypass RLS — deleted users are hidden by RLS policies,
      // which causes the callback to think the user is new and attempt a duplicate INSERT.
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const adminClient = serviceKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
        : supabase;

      // Check by ID first — handles re-registration after soft-delete
      // (same auth user ID, but email was hashed during deletion)
      const { data: userById } = await adminClient
        .from('users')
        .select('id, username, email, account_status')
        .eq('id', session.user.id)
        .single();

      if (userById) {
        if (userById.account_status === 'deleted') {
          // Re-registering after account deletion — reset the row
          const emailParts = (session.user.email || '').split('@');
          const baseUsername = emailParts[0] || 'user';
          let username = baseUsername;
          let counter = 1;
          let isUnique = false;
          const MAX_ATTEMPTS = 20;

          while (!isUnique && counter <= MAX_ATTEMPTS) {
            const { data: usernameCheck } = await adminClient
              .from('users')
              .select('username')
              .eq('username', username)
              .neq('id', session.user.id)
              .single();

            if (!usernameCheck) {
              isUnique = true;
            } else {
              username = `${baseUsername}${counter}`;
              counter++;
            }
          }

          if (!isUnique) {
            username = `${baseUsername}_${Date.now().toString(36).slice(-5)}`;
          }

          await adminClient
            .from('users')
            .update({
              email: session.user.email,
              username: username.toLowerCase(),
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
              user_type: 'normal_user',
              account_status: 'active',
              status_reason: null,
              is_verified: false,
              is_onboarding_done: false,
              last_seen: new Date().toISOString(),
            })
            .eq('id', session.user.id);
        } else {
          // Existing active/deactivated user — update last_seen
          await adminClient
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', session.user.id);
        }
      } else {
        // Truly new user — also check by email to catch edge cases
        const { data: userByEmail } = await adminClient
          .from('users')
          .select('id, account_status')
          .eq('email', session.user.email)
          .single();

        if (userByEmail && userByEmail.account_status === 'deleted') {
          // Old deleted row with same email but different auth ID — clean it up
          await adminClient
            .from('users')
            .delete()
            .eq('id', userByEmail.id);
        } else if (userByEmail) {
          // Existing user with same email but different auth ID — update ID
          await adminClient
            .from('users')
            .update({ id: session.user.id, last_seen: new Date().toISOString() })
            .eq('id', userByEmail.id);
          return NextResponse.redirect(requestUrl.origin);
        }

        // Create new user record
        if (session.user.email) {
          const emailParts = session.user.email.split('@');
          const baseUsername = emailParts[0];

          let username = baseUsername;
          let counter = 1;
          let isUnique = false;
          const MAX_ATTEMPTS = 20;

          while (!isUnique && counter <= MAX_ATTEMPTS) {
            const { data: usernameCheck } = await adminClient
              .from('users')
              .select('username')
              .eq('username', username)
              .single();

            if (!usernameCheck) {
              isUnique = true;
            } else {
              username = `${baseUsername}${counter}`;
              counter++;
            }
          }

          if (!isUnique) {
            username = `${baseUsername}_${Date.now().toString(36).slice(-5)}`;
          }

          const { error: insertError } = await adminClient
            .from('users')
            .insert({
              id: session.user.id,
              email: session.user.email,
              username: username.toLowerCase(),
              full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
              avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
              user_type: 'normal_user',
              is_verified: false,
              is_onboarding_done: false,
              created_at: new Date().toISOString(),
              last_seen: new Date().toISOString()
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating user:', insertError);
          }
        }
      }
    }
  }

  // Redirect to the page the user was on before signing in (if provided)
  const redirectPath = requestUrl.searchParams.get('redirect');
  if (redirectPath && redirectPath.startsWith('/')) {
    return NextResponse.redirect(`${requestUrl.origin}${redirectPath}`);
  }

  return NextResponse.redirect(requestUrl.origin);
}
