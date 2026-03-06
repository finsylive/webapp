import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserInterestProfile } from './types';
import { INTEREST_PROFILE_STALE_HOURS } from './constants';

// In-memory cache for interest profiles
const profileCache = new Map<string, { profile: UserInterestProfile; fetchedAt: number }>();

/**
 * Get or compute a user's interest profile.
 * Uses in-memory cache with staleness check, falls back to DB, recomputes if stale.
 */
export async function getUserInterestProfile(supabase: SupabaseClient, userId: string): Promise<UserInterestProfile | null> {
  // Check in-memory cache
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < INTEREST_PROFILE_STALE_HOURS * 60 * 60 * 1000) {
    return cached.profile;
  }

  // Check DB
  const { data: existing } = await supabase
    .from('user_interest_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (existing) {
    const computedAt = new Date(existing.computed_at).getTime();
    const isStale = Date.now() - computedAt > INTEREST_PROFILE_STALE_HOURS * 60 * 60 * 1000;

    if (!isStale) {
      const profile = existing as UserInterestProfile;
      profileCache.set(userId, { profile, fetchedAt: Date.now() });
      return profile;
    }
  }

  // Recompute via RPC
  try {
    await supabase.rpc('compute_user_interest_profile', { p_user_id: userId });

    const { data: fresh } = await supabase
      .from('user_interest_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fresh) {
      const profile = fresh as UserInterestProfile;
      profileCache.set(userId, { profile, fetchedAt: Date.now() });
      return profile;
    }
  } catch (error) {
    console.warn('Failed to compute interest profile:', error);
  }

  // Return existing even if stale, or null
  if (existing) {
    const profile = existing as UserInterestProfile;
    profileCache.set(userId, { profile, fetchedAt: Date.now() });
    return profile;
  }

  return null;
}

/**
 * Invalidate cached profile for a user (e.g. after significant interaction).
 */
export function invalidateProfileCache(userId: string) {
  profileCache.delete(userId);
}
