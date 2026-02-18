// Feed Engine Constants

export const FEED_EVENT_TYPES = {
  IMPRESSION: 'impression',
  DWELL: 'dwell',
  SCROLL_PAST: 'scroll_past',
  CLICK: 'click',
  LIKE: 'like',
  UNLIKE: 'unlike',
  REPLY: 'reply',
  SHARE: 'share',
  BOOKMARK: 'bookmark',
  POLL_VOTE: 'poll_vote',
  PROFILE_CLICK: 'profile_click',
  EXPAND_CONTENT: 'expand_content',
} as const;

// Event weight multipliers for interest profile computation
export const EVENT_WEIGHTS: Record<string, number> = {
  reply: 5.0,
  share: 4.0,
  like: 3.0,
  bookmark: 3.0,
  poll_vote: 2.5,
  click: 2.0,
  profile_click: 1.5,
  expand_content: 1.0,
  dwell: 0.5,
  impression: 0.1,
  scroll_past: 0.0,
  unlike: -1.0,
};

// Ranking weights for Tier 1 deterministic scoring
export const RANKING_WEIGHTS = {
  engagement: 0.15,
  virality: 0.10,
  following: 0.20,
  fof: 0.05,
  interaction_affinity: 0.15,
  creator_affinity: 0.10,
  topic_overlap: 0.10,
  freshness: 0.10,
  content_type: 0.03,
  media: 0.02,
};

// Cache configuration
export const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const CACHE_TTL_HOURS = 2;

// Pipeline configuration
export const CANDIDATE_POOL_SIZE = 200;
export const LLM_RERANK_TOP_N = 50;
export const FEED_PAGE_SIZE = 20;

// Event batching configuration
export const EVENT_BATCH_FLUSH_INTERVAL_MS = 10_000; // 10 seconds
export const EVENT_BATCH_MAX_SIZE = 20;

// Impression detection
export const IMPRESSION_VISIBILITY_THRESHOLD = 0.5; // 50% visible
export const IMPRESSION_MIN_DWELL_MS = 500; // 500ms minimum

// Freshness decay
export const FRESHNESS_DECAY_HALF_LIFE_HOURS = 24;

// Diversity rules
export const MAX_SAME_AUTHOR_IN_TOP_20 = 2;
export const MAX_CONSECUTIVE_SAME_TYPE = 3;
export const MIN_FRESH_POSTS_IN_TOP_10 = 0.3; // 30%
export const FRESH_POST_MAX_AGE_HOURS = 6;
export const NEW_CREATOR_BOOST = 1.2;
export const NEW_CREATOR_AGE_DAYS = 30;

// Real-time injection positions in cached feed
export const REALTIME_INJECTION_POSITIONS = [0, 4, 9]; // positions 1, 5, 10 (0-indexed)

// Interest profile config
export const INTEREST_PROFILE_STALE_HOURS = 1;
export const INTEREST_DECAY_DAYS = 7;
export const MAX_CREATOR_AFFINITIES = 50;

// Groq configuration
export const GROQ_MODEL = 'llama-3.3-70b-versatile';
export const GROQ_TEMPERATURE = 0.3;
export const GROQ_MAX_TOKENS = 2048;

// Session config
export const SESSION_HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Post features computation
export const POST_FEATURES_STALE_HOURS = 1;

// A/B experiment bucketing
export const EXPERIMENT_BUCKET_COUNT = 10000;
