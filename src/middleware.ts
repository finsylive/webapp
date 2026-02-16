import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that bypass onboarding checks
const ONBOARDING_BYPASS_PREFIXES = [
  '/onboarding',
  '/auth',
  '/api',
  '/_next',
  '/icons',
  '/logo',
];

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error && !error.message?.includes('Auth session missing')) {
      console.error('Middleware auth error:', error.message);
    }

    if (user) {
      supabaseResponse.headers.set('x-user-id', user.id);

      // Onboarding redirect: check if user needs to complete onboarding
      const pathname = req.nextUrl.pathname;
      const isBypassRoute = ONBOARDING_BYPASS_PREFIXES.some(prefix => pathname.startsWith(prefix));

      if (!isBypassRoute) {
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('is_onboarding_done')
          .eq('id', user.id)
          .single();

        console.log('[Middleware] Onboarding check for', user.id, '→', {
          userProfile,
          profileError: profileError?.message,
          pathname,
        });

        // Redirect if is_onboarding_done is explicitly false OR null (not yet set)
        if (userProfile && userProfile.is_onboarding_done !== true) {
          const onboardingUrl = new URL('/onboarding', req.url);
          const redirectResponse = NextResponse.redirect(onboardingUrl);
          // Preserve supabase auth cookies on the redirect response
          supabaseResponse.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
          });
          return redirectResponse;
        }
      }
    }
  } catch (error) {
    console.error('Middleware error:', error);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
