import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProcessedImageUrl } from '@/utils/imageUtils';
import { cacheGet, cacheSet } from '@/lib/cache';
import { resolveEnvironmentBanner, resolveEnvironmentPicture } from '@/lib/environmentAssets';

export const runtime = 'nodejs';

const CACHE_KEY = 'environments:all:v2';
const CACHE_TTL = 300; // 5 minutes — environments rarely change

// Type definition matching the database table
export interface Environment {
  id: string;
  name: string;
  picture: string | null;
  created_at: string;
  banner: string | null;
  description: string | null;
}

function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not set');
  }
  return createClient(url, anonKey);
}

export async function GET() {
  try {
    // Check cache first
    const cached = cacheGet<Environment[]>(CACHE_KEY);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { 'X-Cache': 'HIT', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }

    const supabase = getServerSupabase();

    const { data, error } = await supabase
      .from('environments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching environments:', error);
      return NextResponse.json({ error: 'Failed to fetch environments' }, { status: 500 });
    }

    const list = Array.isArray(data) ? data : [];

    // Process image URLs via proxy/optimizer if available
    const processed = await Promise.all(
      list.map(async (env) => {
        try {
          const picture = resolveEnvironmentPicture(env.name, env.picture);
          const banner = resolveEnvironmentBanner(env.name, env.banner);
          const [processedPicture, processedBanner] = await Promise.all([
            getProcessedImageUrl(picture),
            getProcessedImageUrl(banner),
          ]);
          return { ...env, picture: processedPicture, banner: processedBanner } as Environment;
        } catch (e) {
          console.warn('Image processing failed for env', env.id, e);
          return {
            ...env,
            picture: resolveEnvironmentPicture(env.name, env.picture),
            banner: resolveEnvironmentBanner(env.name, env.banner),
          } as Environment;
        }
      })
    );

    // Cache the processed result
    cacheSet(CACHE_KEY, processed, CACHE_TTL);

    return NextResponse.json(processed, {
      status: 200,
      headers: { 'X-Cache': 'MISS', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('Unexpected error in /api/environments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
