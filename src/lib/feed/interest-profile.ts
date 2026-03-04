import type { UserInterestProfile } from './types';
import { INTEREST_PROFILE_STALE_HOURS } from './constants';
import { createAdminClient } from '@/utils/supabase-server';
import { getRedis } from './redis';

// In-memory cache (per-process, cleared on deploy)
const profileCache = new Map<string, { profile: UserInterestProfile; fetchedAt: number }>();

const STALE_MS = INTEREST_PROFILE_STALE_HOURS * 60 * 60 * 1000;

/**
 * Get or compute a user's interest profile.
 * 3-layer cache: in-memory → Redis → Postgres → RPC recompute.
 */
export async function getUserInterestProfile(userId: string): Promise<UserInterestProfile | null> {
  // Layer 1: In-memory (same process, <1ms)
  const memCached = profileCache.get(userId);
  if (memCached && Date.now() - memCached.fetchedAt < STALE_MS) {
    return memCached.profile;
  }

  // Layer 2: Redis (~5ms)
  const redis = getRedis();
  if (redis) {
    try {
      const redisCached = await redis.get<UserInterestProfile>(`feed:profile:${userId}`);
      if (redisCached && redisCached.computed_at) {
        const computedAt = new Date(redisCached.computed_at).getTime();
        if (Date.now() - computedAt < STALE_MS) {
          profileCache.set(userId, { profile: redisCached, fetchedAt: Date.now() });
          return redisCached;
        }
      }
    } catch {
      // Fall through to Postgres
    }
  }

  // Layer 3: Postgres (~50ms)
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from('user_interest_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const computedAt = new Date(existing.computed_at).getTime();
    const isStale = Date.now() - computedAt > STALE_MS;

    if (!isStale) {
      const profile = existing as UserInterestProfile;
      await cacheProfile(userId, profile);
      return profile;
    }
  }

  // Layer 4: Recompute via RPC
  try {
    await supabase.rpc('compute_user_interest_profile', { p_user_id: userId });
    const { data: fresh } = await supabase
      .from('user_interest_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fresh) {
      const profile = fresh as UserInterestProfile;
      await cacheProfile(userId, profile);
      return profile;
    }
  } catch (error) {
    console.warn('[Feed] Failed to compute interest profile:', error);
  }

  // Return stale data rather than nothing
  if (existing) {
    const profile = existing as UserInterestProfile;
    await cacheProfile(userId, profile);
    return profile;
  }

  return null;
}

async function cacheProfile(userId: string, profile: UserInterestProfile) {
  // Memory
  profileCache.set(userId, { profile, fetchedAt: Date.now() });
  // Redis
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`feed:profile:${userId}`, profile, {
        ex: INTEREST_PROFILE_STALE_HOURS * 3600,
      });
    } catch {
      // Non-critical
    }
  }
}

/**
 * Invalidate cached profile for a user.
 */
export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
  const redis = getRedis();
  if (redis) {
    redis.del(`feed:profile:${userId}`).catch(() => {});
  }
}
