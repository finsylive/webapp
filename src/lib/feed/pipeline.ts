import type { SupabaseClient } from '@supabase/supabase-js';
import { generateCandidates } from './candidate-generator';
import { extractFeatures } from './feature-extractor';
import { scorePostsDeterministic } from './scorer';
import { groqRerank } from './groq-ranker';
import { applyDiversityRules } from './reranker';
import { getCachedFeed, writeFeedCache } from './cache-manager';
import { injectRealtimePosts } from './realtime-injector';
import { getUserInterestProfile } from './interest-profile';
import { getExperimentConfig } from './experiments';
import { FEED_PAGE_SIZE } from './constants';
import type { FeedResponse, ScoredPost } from './types';

/**
 * Main feed pipeline orchestrator.
 * Checks cache first, runs full pipeline if needed.
 * Designed to never throw — always returns a response (even if empty).
 */
export async function generatePersonalizedFeed(
  supabase: SupabaseClient,
  userId: string,
  cursor?: string,
  forceRefresh: boolean = false
): Promise<FeedResponse> {
  // Step 0: Check for active experiments (non-critical, safe to fail)
  let experiment: { experimentId: string; variant: string; config: Record<string, number> } | null = null;
  try {
    experiment = await getExperimentConfig(supabase, userId);
  } catch (err) {
    console.warn('Failed to get experiment config (non-critical):', err);
  }

  // Step 1: Check cache (unless force refresh)
  if (!forceRefresh) {
    try {
      const cached = await getCachedFeed(supabase, userId, cursor);
      if (cached) {
        // Real-time injection for page 1 only (no cursor)
        let postIds = cached.posts;
        let scores = cached.scores;

        if (!cursor) {
          try {
            const injected = await injectRealtimePosts(
              supabase,
              userId,
              cached.entry.post_ids,
              cached.entry.scores,
              cached.entry.computed_at
            );
            postIds = injected.postIds.slice(0, FEED_PAGE_SIZE);
            scores = injected.scores.slice(0, FEED_PAGE_SIZE);
          } catch (injectErr) {
            console.warn('Real-time injection failed (using cached feed):', injectErr);
          }
        }

        const posts = await hydrateScoredPosts(postIds, scores);

        return {
          posts,
          cursor: postIds.length > 0 ? postIds[postIds.length - 1] : undefined,
          has_more: cached.hasMore,
          source: 'cache',
          experiment_id: cached.entry.experiment_id || null,
          variant: cached.entry.variant || null,
          computed_at: cached.entry.computed_at,
        };
      }
    } catch (cacheErr) {
      console.warn('Feed cache check failed (non-critical):', cacheErr);
    }
  }

  // Step 2: Run full pipeline
  try {
    console.log('[Feed] Running full pipeline for user:', userId);
    const scored = await runFullPipeline(supabase, userId, experiment);
    console.log(`[Feed] Pipeline returned ${scored.length} scored posts`);

    if (scored.length > 0) {
      // Step 3: Cache the result (non-critical)
      try {
        await writeFeedCache(
          supabase,
          userId,
          scored,
          experiment?.experimentId,
          experiment?.variant
        );
      } catch (cacheWriteErr) {
        console.warn('Failed to cache feed results (non-critical):', cacheWriteErr);
      }

      // Step 4: Paginate
      const page = scored.slice(0, FEED_PAGE_SIZE);
      const hasMore = scored.length > FEED_PAGE_SIZE;

      return {
        posts: page,
        cursor: page.length > 0 ? page[page.length - 1].post_id : undefined,
        has_more: hasMore,
        source: 'pipeline',
        experiment_id: experiment?.experimentId || null,
        variant: experiment?.variant || null,
        computed_at: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.warn('[Feed] Pipeline failed:', error);
  }

  // Step 5: Fallback — return empty so the API route can use its own chronological fallback
  console.log('[Feed] Returning empty — API route will use chronological fallback');
  return {
    posts: [],
    has_more: false,
    source: 'fallback',
    experiment_id: null,
    variant: null,
    computed_at: new Date().toISOString(),
  };
}

async function runFullPipeline(
  supabase: SupabaseClient,
  userId: string,
  experiment: { experimentId: string; variant: string; config: Record<string, number> } | null
): Promise<ScoredPost[]> {
  // Stage 1: Candidate generation
  const candidates = await generateCandidates(supabase, userId);

  if (candidates.length === 0) {
    return [];
  }

  // Stage 2: Get user interest profile (non-blocking — null is fine)
  let userProfile: Awaited<ReturnType<typeof getUserInterestProfile>> = null;
  try {
    userProfile = await getUserInterestProfile(supabase, userId);
  } catch (err) {
    console.warn('[Feed] Interest profile failed (non-critical):', err);
  }

  // Stage 3: Feature extraction (resilient — works without ML tables)
  let features: Awaited<ReturnType<typeof extractFeatures>>;
  try {
    features = await extractFeatures(supabase, candidates, userId, userProfile);
  } catch (err) {
    console.warn('[Feed] Feature extraction failed, using basic features:', err);
    // Build basic features from candidate data alone
    features = candidates.map((c) => {
      const ageHours = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);
      const maxLikes = Math.max(1, ...candidates.map(x => x.likes_count));
      const maxReplies = Math.max(1, ...candidates.map(x => x.replies_count));
      return {
        post_id: c.id,
        author_id: c.author_id,
        engagement_score: 0,
        virality_velocity: 0,
        likes_normalized: c.likes_count / maxLikes,
        replies_normalized: c.replies_count / maxReplies,
        is_following: c.is_following,
        is_fof: c.is_fof,
        interaction_affinity: 0,
        creator_affinity: 0,
        topic_overlap_score: 0,
        content_type_preference: 0.5,
        keyword_match: 0,
        freshness: Math.exp(-ageHours / 24),
        age_hours: ageHours,
        is_verified: c.author_is_verified,
        follower_count_normalized: 0,
        has_media: c.has_media,
        has_poll: c.has_poll,
        content_quality: 0.5,
      };
    });
  }

  // Stage 4: Tier 1 - Deterministic scoring
  const weightOverrides = experiment?.config;
  const tier1Scored = scorePostsDeterministic(features, weightOverrides);

  // Stage 5: Tier 2 - Groq LLM re-ranking (top 50, non-blocking)
  let tier2Scored = tier1Scored;
  try {
    const postSummaries = new Map(
      candidates.map((c) => [c.id, c.content || ''])
    );
    tier2Scored = await groqRerank(tier1Scored, userProfile, postSummaries);
  } catch (err) {
    console.warn('[Feed] Groq re-ranking failed (non-critical):', err);
  }

  // Stage 6: Diversity rules
  const finalScored = applyDiversityRules(tier2Scored, experiment?.config);

  return finalScored;
}

/**
 * Hydrate post IDs with full scored post data.
 */
async function hydrateScoredPosts(postIds: string[], scores: number[]): Promise<ScoredPost[]> {
  return postIds.map((id, i) => ({
    post_id: id,
    author_id: '', // Will be filled by the API route
    score: scores[i] || 0,
    tier1_score: scores[i] || 0,
    features: {
      post_id: id,
      author_id: '',
      engagement_score: 0,
      virality_velocity: 0,
      likes_normalized: 0,
      replies_normalized: 0,
      is_following: false,
      is_fof: false,
      interaction_affinity: 0,
      creator_affinity: 0,
      topic_overlap_score: 0,
      content_type_preference: 0,
      keyword_match: 0,
      freshness: 0,
      age_hours: 0,
      is_verified: false,
      follower_count_normalized: 0,
      has_media: false,
      has_poll: false,
      content_quality: 0.5,
    },
  }));
}
