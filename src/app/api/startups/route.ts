import { createAuthClient } from '@/utils/supabase-server';
import { NextResponse } from 'next/server';
import { fetchStartups, createStartup } from '@/api/startups';
import { cacheGet, cacheSet, cacheClearByPrefix } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const CACHE_PREFIX = 'startups';
const CACHE_TTL = 60; // 1 minute

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const stage = searchParams.get('stage') || undefined;
    const raising = searchParams.get('raising') === 'true' ? true : undefined;
    const keyword = searchParams.get('keyword') || undefined;
    const search = searchParams.get('search') || undefined;
    const entity_type = (searchParams.get('entity_type') as 'org_project' | 'startup' | null) || undefined;

    // Check cache
    const cacheKey = `${CACHE_PREFIX}:limit=${limit}&offset=${offset}&stage=${stage || ''}&raising=${raising || ''}&kw=${keyword || ''}&search=${search || ''}&type=${entity_type || ''}`;
    const cached = cacheGet<{ data: unknown; hasMore: boolean }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
      });
    }

    const { data, error, hasMore } = await fetchStartups({ limit, offset, stage, raising, keyword, search, entity_type });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const result = { data, hasMore };
    cacheSet(cacheKey, result, CACHE_TTL);

    return NextResponse.json(result, {
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('Error fetching startups:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Use cookie-based auth client — properly reads session from the request cookies
    const authClient = await createAuthClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { data, error } = await createStartup({
      ...body,
      owner_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    cacheClearByPrefix(CACHE_PREFIX);

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error creating startup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
