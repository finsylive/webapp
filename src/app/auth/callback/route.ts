import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Exchange code for session
    const { data: { session }, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (sessionError) {
      console.error('Error exchanging code for session:', sessionError);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=auth_failed`);
    }
    
    if (session?.user) {
      // Check if user exists in our database
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', session.user.email)
        .single();
      
      // If user doesn't exist, create a new user record
      if (!existingUser && session.user.email) {
        // Extract username from email (part before @)
        const emailParts = session.user.email.split('@');
        const baseUsername = emailParts[0];
        
        // Check if username already exists and make it unique if needed
        let username = baseUsername;
        let counter = 1;
        let isUnique = false;
        
        while (!isUnique) {
          const { data: usernameCheck } = await supabase
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
        
        // Create new user record
        const { data: newUser, error: insertError } = await supabase
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
          // Don't fail the auth, just log the error
        } else {
          console.log('New user created:', newUser);
        }
      } else if (existingUser) {
        // Update last_seen for existing user
        await supabase
          .from('users')
          .update({ last_seen: new Date().toISOString() })
          .eq('id', session.user.id);
      }
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin);
}
