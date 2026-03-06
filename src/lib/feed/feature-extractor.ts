import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostFeatureVector, UserInterestProfile } from './types';
import type { RawCandidate } from './candidate-generator';
import { FRESHNESS_DECAY_HALF_LIFE_HOURS } from './constants';

/**
 * Build a PostFeatureVector for each candidate post.
 */
export async function extractFeatures(
  supabase: SupabaseClient,
  candidates: RawCandidate[],
  userId: string,
  userProfile: UserInterestProfile | null
): Promise<PostFeatureVector[]> {
  // Batch fetch post features
  const postIds = candidates.map((c) => c.id);
  const { data: postFeatures } = await supabase
    .from('post_features')
    .select('*')
    .in('post_id', postIds);

  const featuresMap = new Map<string, Record<string, unknown>>();
  (postFeatures || []).forEach((pf: Record<string, unknown>) => {
    featuresMap.set(pf.post_id as string, pf);
  });

  // Batch fetch content embeddings for topic matching
  const { data: embeddings } = await supabase
    .from('content_embeddings')
    .select('post_id, topics, keywords')
    .in('post_id', postIds);

  const embeddingsMap = new Map<string, { topics: string[]; keywords: string[] }>();
  (embeddings || []).forEach((e: { post_id: string; topics: string[]; keywords: string[] }) => {
    embeddingsMap.set(e.post_id, { topics: e.topics, keywords: e.keywords });
  });

  // Get user's interaction graph
  const authorIds = [...new Set(candidates.map((c) => c.author_id))];
  const { data: interactions } = await supabase
    .from('user_interaction_graph')
    .select('target_user_id, affinity_score')
    .eq('user_id', userId)
    .in('target_user_id', authorIds);

  const affinityMap = new Map<string, number>();
  (interactions || []).forEach((i: { target_user_id: string; affinity_score: number }) => {
    affinityMap.set(i.target_user_id, i.affinity_score);
  });

  // Normalize values
  const maxLikes = Math.max(1, ...candidates.map((c) => c.likes_count));
  const maxReplies = Math.max(1, ...candidates.map((c) => c.replies_count));
  const maxFollowers = Math.max(1, ...candidates.map((c) => c.author_follower_count));
  const maxAffinity = Math.max(1, ...[...affinityMap.values()]);

  // User's topic interests
  const userTopics = userProfile?.topic_scores || {};
  const userContentPrefs = userProfile?.content_type_preferences || {};
  const userCreatorAffinities = userProfile?.creator_affinities || {};

  return candidates.map((c) => {
    const pf = featuresMap.get(c.id);
    const emb = embeddingsMap.get(c.id);
    const ageHours = (Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60);

    // Topic overlap score
    let topicOverlap = 0;
    if (emb?.topics && Object.keys(userTopics).length > 0) {
      const matchingTopics = emb.topics.filter((t) => userTopics[t] !== undefined);
      const totalWeight = matchingTopics.reduce((sum, t) => sum + (userTopics[t] || 0), 0);
      topicOverlap = Math.min(1, totalWeight / 10);
    }

    // Keyword match (simple overlap)
    let keywordMatch = 0;
    if (emb?.keywords && Object.keys(userTopics).length > 0) {
      const topicKeys = Object.keys(userTopics);
      const matches = emb.keywords.filter((k) => topicKeys.some((t) => k.includes(t) || t.includes(k)));
      keywordMatch = Math.min(1, matches.length / 3);
    }

    // Content type preference
    const contentTypePref = userContentPrefs[c.post_type] || 0.5;

    // Creator affinity from profile
    const creatorAffinity = Math.min(1, (userCreatorAffinities[c.author_id] || 0) / 10);

    // Interaction affinity from graph
    const interactionAffinity = affinityMap.has(c.author_id)
      ? affinityMap.get(c.author_id)! / maxAffinity
      : 0;

    // Freshness: exponential decay
    const freshness = Math.exp(-ageHours / FRESHNESS_DECAY_HALF_LIFE_HOURS);

    return {
      post_id: c.id,
      author_id: c.author_id,
      engagement_score: pf ? (pf.engagement_score as number) : 0,
      virality_velocity: pf ? Math.min(1, (pf.virality_velocity as number) / 10) : 0,
      likes_normalized: c.likes_count / maxLikes,
      replies_normalized: c.replies_count / maxReplies,
      is_following: c.is_following,
      is_fof: c.is_fof,
      interaction_affinity: interactionAffinity,
      creator_affinity: creatorAffinity,
      topic_overlap_score: topicOverlap,
      content_type_preference: contentTypePref,
      keyword_match: keywordMatch,
      freshness,
      age_hours: ageHours,
      is_verified: c.author_is_verified,
      follower_count_normalized: c.author_follower_count / maxFollowers,
      has_media: c.has_media,
      has_poll: c.has_poll,
      content_quality: pf ? (pf.content_quality as number) : 0.5,
    };
  });
}
