import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Create an authenticated Supabase client for use in Route Handlers.
 * Uses the user's session cookies so RLS policies are respected.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-web-auth',
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in read-only contexts (e.g. Server Components)
          }
        },
      },
    }
  );
}
