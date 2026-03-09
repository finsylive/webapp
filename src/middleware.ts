import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/* ──────────────────────────────────────────────────
   Lightweight in-memory rate limiter for API routes.
   Tracks request counts per IP in a sliding window.
   NOTE: This works per-instance. For multi-instance
   deployments, upgrade to Redis-based rate limiting
   (e.g., @upstash/ratelimit).
   ────────────────────────────────────────────────── */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 120; // max requests per window per IP

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup of expired entries (every 2 min)
let rateLimitCleanupTimer: ReturnType<typeof setInterval> | null = null;
function ensureRateLimitCleanup() {
  if (rateLimitCleanupTimer) return;
  rateLimitCleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
    if (rateLimitStore.size === 0 && rateLimitCleanupTimer) {
      clearInterval(rateLimitCleanupTimer);
      rateLimitCleanupTimer = null;
    }
  }, 120_000);
  if (rateLimitCleanupTimer && typeof rateLimitCleanupTimer === 'object' && 'unref' in rateLimitCleanupTimer) {
    rateLimitCleanupTimer.unref();
  }
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry || entry.resetAt <= now) {
    // New window
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    ensureRateLimitCleanup();
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT_MAX_REQUESTS;
}

export async function middleware(req: NextRequest) {
  // Rate limit API routes only
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
  }

  // Track cookies that Supabase SSR sets (token refresh etc.)
  // so we can always rebuild supabaseResponse without losing them.
  let pendingCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  let supabaseResponse = NextResponse.next({ request: req });

  const rebuildResponse = () => {
    supabaseResponse = NextResponse.next({ request: req });
    for (const { name, value, options } of pendingCookies) {
      supabaseResponse.cookies.set(name, value, options);
    }
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-web-auth',
      },
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies = cookiesToSet;
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value)
          );
          rebuildResponse();
        },
      },
    }
  );

  try {
    // Use getSession() for middleware — it validates the JWT locally without a network
    // call, which is critical since middleware runs on EVERY request. Sensitive operations
    // in API routes still use getUser() for full server-side verification.
    const { data: { session }, error } = await supabase.auth.getSession();
    const user = session?.user ?? null;

    if (error && !error.message?.includes('Auth session missing')) {
      console.error('Middleware auth error:', error.message);
    }

    // ── Protected Page Guard ──────────────────────────────
    // Redirect unauthenticated users away from pages that require login
    const PROTECTED_PREFIXES = ['/messages', '/settings', '/create', '/profile/edit', '/startups', '/search', '/hub', '/posts', '/onboarding'];
    const pathname = req.nextUrl.pathname;
    const isProtectedPage = PROTECTED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));

    if (isProtectedPage && !user) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = '/';
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user) {
      // Set x-user-id as a REQUEST header so API routes can read it
      // via request.headers.get('x-user-id') — avoids auth.getUser() network call
      req.headers.set('x-user-id', user.id);
      rebuildResponse();

      // ── Account Status Guard ──────────────────────────────
      // Only check account status on key entry-point pages (not every navigation)
      // to avoid a DB round-trip on every single request.
      const STATUS_CHECK_PATHS = ['/hub', '/messages', '/settings', '/startups', '/search'];
      const needsStatusCheck = STATUS_CHECK_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

      if (needsStatusCheck) {
        try {
          const { data: profile } = await supabase
            .from('users')
            .select('account_status')
            .eq('id', user.id)
            .single();

          if (profile && profile.account_status === 'deactivated') {
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = '/reactivate';
            redirectUrl.search = '';
            return NextResponse.redirect(redirectUrl);
          }

          if (profile && (profile.account_status === 'deleted' || profile.account_status === 'suspended')) {
            await supabase.auth.signOut();
          }
        } catch {
          // If the query fails, allow the request through
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
