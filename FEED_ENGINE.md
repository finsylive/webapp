# Ments AI Feed Engine

Technical documentation for the AI-powered personalized feed ranking system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How It Works (High-Level)](#how-it-works-high-level)
3. [Ranking Pipeline (Deep Dive)](#ranking-pipeline-deep-dive)
4. [Signal Collection & Event Tracking](#signal-collection--event-tracking)
5. [Content Analysis](#content-analysis)
6. [Caching & Real-Time Injection](#caching--real-time-injection)
7. [A/B Testing Framework](#ab-testing-framework)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [File Structure](#file-structure)
11. [Configuration & Tuning](#configuration--tuning)
12. [Fallback Strategy](#fallback-strategy)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                 CLIENT (Next.js)                     │
│                                                     │
│  PersonalizedFeed ──► TrackedPostCard (per post)    │
│       │                    │                        │
│       │               useFeedTracking               │
│       │            (IntersectionObserver)            │
│       │                    │                        │
│  usePersonalizedFeed    FeedEventTracker            │
│       │              (batches 20 events / 10s)      │
└───────┼────────────────────┼────────────────────────┘
        │                    │
   GET /api/feed      POST /api/feed/events
        │                    │
┌───────▼────────────────────▼────────────────────────┐
│              FEED RANKING PIPELINE                   │
│                                                     │
│  1. Candidate Generation ──► 200 posts from DB      │
│  2. Feature Extraction   ──► 19-dim feature vectors │
│  3. Tier 1 Scoring       ──► Deterministic weights  │
│  4. Tier 2 Re-ranking    ──► Groq LLM (top 50)     │
│  5. Diversity Rules      ──► Author/type/freshness  │
│  6. Cache (2hr TTL)      ──► Supabase table         │
│  7. Real-time Injection  ──► New posts into cache   │
└───────┬─────────────────────────────────────────────┘
        │
┌───────▼─────────────────────────────────────────────┐
│              SUPABASE POSTGRESQL                     │
│                                                     │
│  feed_events          │  user_interest_profiles     │
│  feed_cache           │  content_embeddings         │
│  feed_seen_posts      │  post_features              │
│  user_sessions        │  trending_topics            │
│  user_interaction_graph │  feed_experiments          │
│  feed_experiment_assignments │  feed_analytics_daily │
└─────────────────────────────────────────────────────┘
```

**Tech Stack:**
- **Ranking:** TypeScript deterministic scoring + Groq LLM (Llama 3.3 70B)
- **Database:** Supabase PostgreSQL (RPC functions for heavy queries)
- **Cache:** Supabase table with 2-hour TTL (no Redis needed)
- **Client tracking:** IntersectionObserver + batched event flushing
- **Runtime:** Vercel serverless (Next.js API routes)

---

## How It Works (High-Level)

When a user opens their feed:

1. **Check cache** — If a ranked feed was computed in the last 2 hours, serve it immediately. Inject any posts created since the cache was built.

2. **Run full pipeline** (if no cache) — Pull 200 candidate posts, score them across 19 features, re-rank the top 50 with Groq AI, apply diversity rules, cache the result.

3. **Track everything** — Every impression, click, dwell time, like, reply, share, and scroll-past is tracked via IntersectionObserver and batched to the server every 10 seconds.

4. **Learn over time** — User interest profiles are computed from interaction history with time-decay weighting. The more a user interacts, the more personalized their feed becomes.

5. **Fallback gracefully** — If the pipeline fails for any reason, fall back to a simple chronological feed. The user always sees posts.

---

## Ranking Pipeline (Deep Dive)

The pipeline lives in `src/lib/feed/pipeline.ts` and orchestrates 6 stages:

### Stage 1: Candidate Generation

**File:** `src/lib/feed/candidate-generator.ts`

Pulls ~200 candidate posts via Supabase RPC (`get_feed_candidates`):

| Source | Description |
|--------|-------------|
| Following | Posts from users you follow |
| Friends-of-Friends | Posts from 2nd-degree connections |
| Trending | High-engagement posts from anyone |
| Topic matches | Posts matching your interest topics |

Excludes posts you've already seen (`feed_seen_posts` table) and your own posts.

**Fallback:** If the RPC fails, runs a simple query for recent non-deleted root posts ordered by `created_at`.

### Stage 2: Feature Extraction

**File:** `src/lib/feed/feature-extractor.ts`

Builds a **19-dimensional feature vector** for each candidate post:

| Category | Features |
|----------|----------|
| **Engagement** | `engagement_score`, `virality_velocity`, `likes_normalized`, `replies_normalized` |
| **Social** | `is_following`, `is_fof`, `interaction_affinity`, `creator_affinity` |
| **Content** | `topic_overlap_score`, `content_type_preference`, `keyword_match` |
| **Freshness** | `freshness` (exponential decay: `e^(-age_hours / 24)`) |
| **Author** | `is_verified`, `follower_count_normalized` |
| **Richness** | `has_media`, `has_poll`, `content_quality` |

Data sources:
- `post_features` table for engagement/virality/quality scores
- `content_embeddings` table for topic/keyword overlap
- `user_interaction_graph` table for creator affinities
- `user_interest_profiles` for user topic scores and preferences

### Stage 3: Tier 1 — Deterministic Scoring

**File:** `src/lib/feed/scorer.ts`

Applies a weighted linear combination across 10 feature dimensions:

```
score = engagement      × 0.15
      + virality        × 0.10
      + following       × 0.20    ← strongest signal
      + fof             × 0.05
      + interaction     × 0.15
      + creator         × 0.10
      + topic_overlap   × 0.10
      + freshness       × 0.10
      + content_type    × 0.03
      + media           × 0.02
```

This runs on ALL 200 candidates. Fast and deterministic — no API calls.

### Stage 4: Tier 2 — Groq LLM Re-ranking

**File:** `src/lib/feed/groq-ranker.ts`

Takes the **top 50 posts** from Tier 1 and sends them to Groq (Llama 3.3 70B Versatile) for semantic re-ranking.

**What Groq receives:**
- Condensed post summaries (ID, content snippet, tier1 score, age, media flag, verified flag)
- User interest profile (top topics, preferred content types)

**What Groq considers:**
- Interest relevance — does this match what the user cares about?
- Content diversity — avoid repetitive content
- Social signals — following vs. discovery balance
- Freshness tradeoff — mix of fresh and high-quality older posts
- Author deduplication — don't flood with one creator

**What Groq returns:**
- Re-ordered list of post IDs
- Final score = blend of Tier 1 (deterministic) + Tier 2 (LLM position)

**Fallback:** If Groq is unavailable or errors, Tier 1 ordering is used as-is.

**Config:** Temperature 0.2 (conservative), max 2048 tokens.

### Stage 5: Diversity Rules

**File:** `src/lib/feed/reranker.ts`

Hard constraints applied after LLM ranking to ensure feed quality:

| Rule | Constraint |
|------|-----------|
| **Author diversity** | Max 2 posts from same author in top 20 |
| **Type variety** | No more than 3 consecutive posts of same type (text/media/poll) |
| **Freshness guarantee** | At least 30% of top 10 must be from the last 6 hours |
| **New creator boost** | 1.2x score multiplier for accounts < 30 days old |

These rules can be adjusted per A/B experiment variant.

### Stage 6: Cache & Serve

**File:** `src/lib/feed/cache-manager.ts`

The final ranked feed (all scored posts, not just one page) is written to the `feed_cache` table with a 2-hour TTL. Subsequent requests serve from cache with cursor-based pagination (20 posts per page).

---

## Signal Collection & Event Tracking

### Client-Side Tracking

**Files:**
- `src/lib/feed/event-tracker.ts` — Core `FeedEventTracker` class
- `src/hooks/useFeedTracking.ts` — Per-post tracking hook
- `src/hooks/useSessionTracking.ts` — Session lifecycle
- `src/context/FeedTrackingContext.tsx` — React context provider
- `src/components/posts/TrackedPostCard.tsx` — Instrumented post wrapper

### Events Tracked

| Event | Trigger | How |
|-------|---------|-----|
| `impression` | Post 50%+ visible for 500ms+ | IntersectionObserver |
| `dwell` | Post leaves viewport | Timer diff from impression start |
| `scroll_past` | Post visible < 500ms | IntersectionObserver exit |
| `click` | Tap/click on post body | onClick handler |
| `like` / `unlike` | Like button interaction | Callback prop |
| `reply` | Reply submitted | Callback prop |
| `share` | Share/repost action | Callback prop |
| `bookmark` | Bookmark action | Callback prop |
| `poll_vote` | Poll vote cast | Callback prop |
| `profile_click` | Click author avatar/name | Callback prop |
| `expand_content` | Click "Show more" | Callback prop |

### Batching Strategy

Events are buffered client-side and flushed in batches:

- **Buffer size:** 20 events max before auto-flush
- **Timer:** Every 10 seconds
- **Page hide:** Immediate flush via `navigator.sendBeacon()` (reliable on tab close)
- **Retry:** Failed events re-added to buffer (max 60 total)

### Event Weights (for Interest Profile)

Events contribute differently to user interest scores:

```
reply       = 5.0    (strongest positive signal)
share       = 4.0
like        = 3.0
bookmark    = 3.0
poll_vote   = 2.5
click       = 2.0
profile_click = 1.5
expand      = 1.0
dwell       = 0.5
impression  = 0.1    (weakest signal)
scroll_past = 0.0    (neutral)
unlike      = -1.0   (negative signal)
```

### Session Tracking

Each user visit creates a session with:
- Unique session ID (`s_{timestamp}_{random}`)
- Device type detection (mobile/tablet/desktop)
- Heartbeat every 30 seconds
- Auto-end on page hide or 30-minute timeout

---

## Content Analysis

**File:** `src/lib/feed/topic-extractor.ts`

When a post is created, its content is analyzed to extract:
- **3-5 topic tags** (e.g., "technology", "ai", "startups")
- **5-10 keywords** (significant terms from the text)
- **Sentiment score** (-1 to +1)
- **Language** detection

### Extraction Methods

**Primary — Groq LLM** (for posts with 20+ characters):
- Sends content to Llama 3.3 70B
- Structured prompt requesting topics, keywords, sentiment
- Parses JSON response

**Fallback — Keyword Analysis** (if Groq unavailable):
- Tokenizes content, filters 109 common stop words
- Ranks by word frequency
- Maps keywords to predefined topic categories
- Topic triggers: "AI", "startup", "funding", "design", "career", etc.

Results stored in `content_embeddings` table, used by feature extraction for topic overlap scoring.

---

## Caching & Real-Time Injection

### Feed Cache

- **Storage:** `feed_cache` Supabase table
- **TTL:** 2 hours
- **Content:** Full ranked list of post IDs + scores
- **Pagination:** Cursor-based (20 posts per page)
- **Invalidation:** On forced refresh (`POST /api/feed/refresh`) or TTL expiry

### Real-Time Injection

**File:** `src/lib/feed/realtime-injector.ts`

When serving from cache, new posts created *after* the cache was built are:

1. Fetched from the database (up to 10 newest)
2. Feature-extracted and quick-scored (Tier 1 only — no LLM call)
3. Injected at strategic positions in the cached feed: **positions 0, 4, and 9**

This ensures users see fresh content even when the main pipeline hasn't re-run.

### Real-Time Notifications

**File:** `src/hooks/useRealtimeFeedUpdates.ts`

A Supabase Realtime subscription listens for new post inserts. When new posts arrive, a banner appears: **"X new posts"** — clicking it refreshes the feed.

---

## A/B Testing Framework

### How It Works

**File:** `src/lib/feed/experiments.ts`

1. **Create experiment** — Define name, variants (each with weight and config overrides), metrics to track
2. **User bucketing** — Deterministic hash: `hash(experimentId + userId) % 10000`. Same user always gets the same variant.
3. **Variant application** — During pipeline Stage 5 (diversity rules), experiment config modifies ranking weights (e.g., variant A might boost `freshness_weight` by 1.5x)
4. **Metric tagging** — Every feed event is tagged with `experiment_id` + `variant`
5. **Analysis** — Statistical significance via Z-test (proportions) and Welch's t-test (means)

### Statistical Tests

**File:** `src/lib/feed/statistics.ts`

| Test | Use Case | Method |
|------|----------|--------|
| Z-test for proportions | CTR, engagement rate comparison | Pooled proportion, standard error |
| Welch's t-test | Dwell time, session depth comparison | Welch-Satterthwaite degrees of freedom |
| Confidence intervals | Point estimates with bounds | 95%/99%/90% configurable |

Results include: test statistic, p-value, confidence intervals, and `isSignificant` flag (p < 0.05).

### Experiment Lifecycle

```
draft → active → paused → active → ended
         │                            │
         └── started_at set           └── ended_at set
```

---

## Database Schema

### 12 Tables

| Table | Purpose |
|-------|---------|
| `feed_events` | Raw event log (impressions, clicks, dwell, likes, etc.) |
| `user_sessions` | Session lifecycle tracking |
| `feed_seen_posts` | Posts each user has already seen |
| `content_embeddings` | AI-extracted topics, keywords, sentiment per post |
| `post_features` | Pre-computed engagement scores, virality, quality |
| `user_interest_profiles` | Aggregated user interests (topics, creators, patterns) |
| `user_interaction_graph` | Pairwise user-to-user interaction frequency |
| `trending_topics` | Detected trending topics with velocity |
| `feed_cache` | Pre-computed personalized feeds (2hr TTL) |
| `feed_experiments` | A/B test experiment definitions |
| `feed_experiment_assignments` | User-to-variant mapping |
| `feed_analytics_daily` | Aggregated daily metrics |

### 5 RPC Functions

| Function | Purpose |
|----------|---------|
| `get_feed_candidates` | Pull candidate posts (following + FOF + trending + topic matches) |
| `batch_insert_feed_events` | Atomic bulk event insertion |
| `compute_user_interest_profile` | Aggregate events into interest profiles with time-decay |
| `compute_post_features` | Calculate engagement score, virality, CTR for a post |
| `update_interaction_graph` | Incremental affinity update between two users |

---

## API Endpoints

### `GET /api/feed`

Main feed endpoint. Returns ranked, paginated posts.

**Query params:**
- `cursor` (optional) — Last post ID for pagination
- `offset` (optional) — Offset for chronological fallback

**Response:**
```json
{
  "posts": [...],
  "cursor": "post-uuid-or-null",
  "has_more": true,
  "source": "cache | pipeline | chronological",
  "experiment_id": "uuid-or-null",
  "variant": "string-or-null"
}
```

### `POST /api/feed/refresh`

Force re-computation of the user's feed. Clears cache and interest profile, re-runs full pipeline.

**Response:**
```json
{
  "ok": true,
  "source": "pipeline",
  "post_count": 100
}
```

### `POST /api/feed/events`

Batch insert feed events and/or manage sessions.

**Request body:**
```json
{
  "events": [
    {
      "user_id": "uuid",
      "session_id": "s_...",
      "post_id": "uuid",
      "author_id": "uuid",
      "event_type": "impression",
      "metadata": { "dwell_ms": 3200 },
      "position_in_feed": 0,
      "experiment_id": null,
      "variant": null
    }
  ],
  "session": {
    "id": "s_...",
    "user_id": "uuid",
    "action": "start | heartbeat | end",
    "device_type": "mobile"
  }
}
```

### `POST /api/feed/extract-topics`

Extract topics and keywords from a post's content (called after post creation).

**Request body:**
```json
{
  "post_id": "uuid",
  "content": "Post text here...",
  "post_type": "text"
}
```

### `GET /api/feed/experiments`

List all A/B experiments.

### `POST /api/feed/experiments`

Create a new A/B experiment with variants and metrics.

---

## File Structure

```
src/lib/feed/
├── types.ts                 # All TypeScript interfaces
├── constants.ts             # Ranking weights, TTLs, thresholds
├── pipeline.ts              # Main orchestrator (cache → pipeline → fallback)
├── candidate-generator.ts   # Stage 1: Pull 200 candidate posts
├── feature-extractor.ts     # Stage 2: Build 19-dim feature vectors
├── scorer.ts                # Stage 3: Deterministic Tier 1 scoring
├── groq-ranker.ts           # Stage 4: Groq LLM Tier 2 re-ranking
├── reranker.ts              # Stage 5: Diversity rules
├── cache-manager.ts         # Stage 6: Feed cache (read/write/invalidate)
├── realtime-injector.ts     # Inject new posts into cached feeds
├── interest-profile.ts      # User interest profile management
├── topic-extractor.ts       # Groq/fallback topic extraction
├── event-tracker.ts         # Client-side FeedEventTracker class
├── experiments.ts           # A/B experiment assignment & management
└── statistics.ts            # Z-test, Welch's t-test, confidence intervals

src/hooks/
├── usePersonalizedFeed.ts       # Fetch ranked feed with pagination
├── useFeedTracking.ts           # Per-post IntersectionObserver tracking
├── useSessionTracking.ts        # Session lifecycle management
└── useRealtimeFeedUpdates.ts    # Supabase Realtime new post detection

src/context/
└── FeedTrackingContext.tsx       # React context for event tracker

src/components/feed/
├── PersonalizedFeed.tsx         # Main feed component
├── NewPostsNotifier.tsx         # "X new posts" banner
├── FeedSuggestions.tsx          # Suggested users widget
└── TrendingPosts.tsx            # Trending posts widget

src/components/posts/
└── TrackedPostCard.tsx          # PostCard wrapper with event tracking

src/app/api/feed/
├── route.ts                     # GET: serve personalized feed
├── refresh/route.ts             # POST: force feed recomputation
├── events/route.ts              # POST: batch event ingestion
├── extract-topics/route.ts      # POST: content topic extraction
└── experiments/route.ts         # GET/POST: experiment management
```

---

## Configuration & Tuning

All configurable values live in `src/lib/feed/constants.ts`:

### Ranking Weights (Tier 1)

| Weight | Default | Description |
|--------|---------|-------------|
| `following` | 0.20 | Posts from users you follow |
| `engagement` | 0.15 | Post engagement score |
| `interaction_affinity` | 0.15 | How much you interact with this creator |
| `virality` | 0.10 | Post virality velocity |
| `creator_affinity` | 0.10 | Creator affinity from profile |
| `topic_overlap` | 0.10 | Topic match with your interests |
| `freshness` | 0.10 | Exponential time decay |
| `fof` | 0.05 | Friends-of-friends signal |
| `content_type` | 0.03 | Content type preference match |
| `media` | 0.02 | Has media bonus |

### Pipeline Config

| Parameter | Value | Description |
|-----------|-------|-------------|
| `CANDIDATE_POOL_SIZE` | 200 | Posts pulled for ranking |
| `LLM_RERANK_TOP_N` | 50 | Posts sent to Groq |
| `FEED_PAGE_SIZE` | 20 | Posts per page |
| `CACHE_TTL_MS` | 7,200,000 | 2-hour cache lifetime |
| `FRESHNESS_DECAY_HALF_LIFE_HOURS` | 24 | Freshness decay rate |
| `GROQ_MODEL` | llama-3.3-70b-versatile | LLM model for re-ranking |

### Tracking Config

| Parameter | Value | Description |
|-----------|-------|-------------|
| `IMPRESSION_VISIBILITY_THRESHOLD` | 0.50 | 50% visible to count |
| `IMPRESSION_MIN_DWELL_MS` | 500 | Min time for impression |
| `SESSION_HEARTBEAT_INTERVAL_MS` | 30,000 | Session heartbeat |
| `SESSION_TIMEOUT_MS` | 1,800,000 | 30-min session timeout |
| Event batch size | 20 | Max events before flush |
| Event flush interval | 10,000ms | Auto-flush timer |

---

## Fallback Strategy

The system is designed to **never fail visibly**. Every component has a fallback:

```
Pipeline Path:
  Groq LLM available?
    ├── Yes → Full 2-tier ranking (AI-powered)
    └── No  → Tier 1 deterministic scoring only

  RPC get_feed_candidates works?
    ├── Yes → Smart candidate selection
    └── No  → Simple chronological query (fallback)

  Pipeline returns posts?
    ├── Yes → Serve ranked feed
    └── No  → Serve chronological feed

  Topic extraction via Groq?
    ├── Yes → LLM-extracted topics + keywords
    └── No  → Keyword frequency analysis (fallback)

  Interest profile available?
    ├── Yes → Personalized feature scoring
    └── No  → Generic scoring (no personalization)

  Cache available?
    ├── Yes → Serve from cache + inject real-time posts
    └── No  → Run full pipeline
```

Every pipeline stage is wrapped in try/catch. If any stage fails, the system degrades gracefully rather than showing an error.

---

## Future Roadmap: Instagram-Grade Upgrades

This section documents the upgrades needed to bring the Ments feed from its current level (comparable to Twitter/X 2018) to Instagram-grade (2025). Each upgrade is independent and can be implemented incrementally.

### Current vs Target

```
Basic Chronological ────── Ments (Current) ────────── Instagram (Target)
    (Twitter 2012)          (Twitter 2018)             (Instagram 2025)

Current:                          Target:
- Weighted linear model           - ML prediction models
- LLM re-ranking (top 50)        - Neural network ranking (all candidates)
- Text-only topic extraction      - Multi-modal understanding (text + image + video)
- Keyword-based matching          - Embedding-based similarity (vector search)
- Time-decay freshness            - Contextual bandits (explore vs exploit)
- Static interest profiles        - Real-time interest adaptation
- Basic event weights             - Calibrated engagement prediction
```

---

### Upgrade 1: ML Engagement Prediction Model

**Priority:** HIGH | **Impact:** 10x ranking quality | **Complexity:** Large

**What Instagram Does:**
For every user-post pair, Instagram predicts:
- `P(like)` — probability the user will like this post
- `P(comment)` — probability the user will comment
- `P(share)` — probability the user will share/send
- `P(save)` — probability the user will save/bookmark
- `P(dwell > 30s)` — probability of extended viewing
- `P(negative)` — probability of hide/report/unfollow

The final ranking score is a weighted combination:
```
score = w1*P(like) + w2*P(comment) + w3*P(share) + w4*P(save)
      + w5*P(dwell>30s) - w6*P(negative)
```

**What Ments Currently Does:**
Uses a static weighted linear formula with hand-tuned weights. No per-user-post prediction.

**Implementation Plan:**

1. **Training Data Collection** (already partially done)
   - We already track: impressions, likes, replies, shares, bookmarks, dwell, scroll_past
   - Need to structure this as training examples:
     ```
     (user_features, post_features, context_features) → engaged (yes/no)
     ```
   - Positive examples: user liked, replied, shared, or dwelled > 15s
   - Negative examples: user saw post (impression) but didn't engage

2. **Feature Engineering**
   - User features: interest profile, activity level, preferred content types, peak hours, follower count, account age
   - Post features: engagement rate, age, content type, author verified, topic tags, media count, text length, sentiment
   - Cross features: is_following, interaction_affinity, topic_overlap, same_environment
   - Context features: time_of_day, day_of_week, position_in_session, device_type

3. **Model Options** (in order of feasibility for Ments stack)

   **Option A: Gradient Boosted Trees (XGBoost/LightGBM) — Recommended**
   - Train offline, export model weights as JSON
   - Run inference in TypeScript at request time (fast, no GPU needed)
   - Accuracy: ~85-90% AUC for engagement prediction
   - Can run on Vercel serverless

   **Option B: Small Neural Network via ONNX Runtime**
   - Train a 3-layer MLP in Python, export to ONNX format
   - Run inference via `onnxruntime-node` in the API route
   - Accuracy: ~88-92% AUC
   - Needs slightly more compute but still serverless-friendly

   **Option C: Hosted ML Endpoint (future scale)**
   - Deploy model on Replicate, Modal, or AWS SageMaker
   - Call via HTTP from the feed pipeline
   - Supports larger models (deep learning, transformers)
   - Adds latency (~50-100ms per request)

4. **Integration into Pipeline**
   - Replace `scorer.ts` (Tier 1) with ML model inference
   - Keep Groq LLM re-ranking (Tier 2) for semantic diversity
   - Keep diversity rules (Stage 5) as hard constraints

5. **Files to Create**
   ```
   src/lib/feed/ml/
   ├── model.ts              # Load and run inference on exported model
   ├── feature-builder.ts    # Build ML feature vectors from raw data
   ├── training-export.ts    # Export training data from feed_events table
   └── model-weights.json    # Exported model (checked into repo or fetched from storage)

   scripts/
   ├── train-feed-model.py   # Python training script (XGBoost/LightGBM)
   └── export-training-data.ts  # Pull labeled data from Supabase
   ```

6. **Training Pipeline**
   ```
   feed_events table → export script → training CSV → Python training → model JSON → deploy
   ```
   Run weekly or when enough new data accumulates (>10K new training examples).

7. **Minimum Data Required**
   - ~50K labeled examples (impressions with engagement outcomes) for a useful model
   - ~500K examples for a good model
   - At ~1000 DAU with 20 impressions/session = 20K examples/day = useful model in 3 days

---

### Upgrade 2: Image & Video Understanding

**Priority:** HIGH | **Impact:** Major for media-heavy platform | **Complexity:** Medium

**What Instagram Does:**
- Runs computer vision models on every image/video
- Extracts: objects, scenes, faces, text (OCR), aesthetics score, NSFW score
- Generates dense vector embeddings for similarity search
- Understanding memes, infographics, screenshots

**What Ments Currently Does:**
- Only analyzes text content via Groq LLM
- `has_media` is a binary feature (true/false) — no understanding of WHAT the media contains

**Implementation Plan:**

1. **Image Embedding Extraction**
   - Use a vision-language model (CLIP, SigLIP, or Llama 3.2 Vision) via Groq/Replicate
   - When a post with media is created, send image to vision model
   - Extract: description, objects, scene, mood, topics, aesthetic score
   - Store in `content_embeddings` table alongside text topics

2. **Vision Model Options**

   **Option A: Groq Vision (Llama 3.2 11B Vision) — Recommended**
   - Already in our stack (Groq API)
   - Send image URL + prompt: "Describe this image. List objects, scene, mood, topics."
   - Parse structured response
   - Cost: ~$0.001 per image

   **Option B: Replicate (CLIP/BLIP-2)**
   - Better for generating dense vector embeddings
   - Can compute image-image and image-text similarity
   - Useful for "similar posts" features

   **Option C: Cloudflare Workers AI**
   - Free tier available
   - CLIP model for embeddings
   - Very low latency

3. **Enhanced Feature Vector**
   Add to `PostFeatureVector`:
   ```typescript
   // New visual features
   image_aesthetic_score: number;    // 0-1, how visually appealing
   image_topic_overlap: number;     // overlap between image topics and user interests
   has_faces: boolean;              // posts with faces get higher engagement
   has_text_overlay: boolean;       // memes, infographics
   visual_complexity: number;       // simple vs complex imagery
   media_count: number;             // carousel posts with more images
   video_duration_seconds: number;  // for video posts
   ```

4. **Files to Create**
   ```
   src/lib/feed/
   ├── vision-analyzer.ts      # Send images to vision model, parse results
   └── media-features.ts       # Extract visual features from analysis results
   ```

5. **Files to Modify**
   ```
   src/lib/feed/feature-extractor.ts  # Add visual features to PostFeatureVector
   src/lib/feed/types.ts              # Extend PostFeatureVector interface
   src/app/api/feed/extract-topics/route.ts  # Also process media when present
   ```

---

### Upgrade 3: Collaborative Filtering

**Priority:** HIGH | **Impact:** Discovers content outside user's bubble | **Complexity:** Medium

**What Instagram Does:**
- "Users similar to you also liked this post"
- Builds user clusters based on engagement patterns
- Uses matrix factorization and graph neural networks
- Powers the Explore page and "Suggested for you" in feed

**What Ments Currently Does:**
- Only ranks based on direct signals (your interactions, your follows, your topics)
- No concept of "users like you"

**Implementation Plan:**

1. **User-Post Interaction Matrix**
   Build a sparse matrix from `feed_events`:
   ```
   Rows: users
   Columns: posts
   Values: engagement score (weighted by event type)
   ```

2. **Collaborative Filtering Approaches**

   **Option A: Item-based CF (simplest) — Start here**
   - For each post, find posts that have similar engagement patterns
   - "Users who liked post A also liked post B"
   - Computed offline, stored in a `post_similarities` table
   - At feed time: boost posts similar to user's recently liked posts

   **Option B: User-based CF**
   - For each user, find users with similar engagement patterns
   - "Users like you also engaged with these posts"
   - Find user's nearest neighbors → recommend their engaged posts
   - Stored in `user_similarities` table

   **Option C: Matrix Factorization (ALS/SVD)**
   - Decompose user-post matrix into latent factors
   - Each user and post gets a dense vector (e.g., 64 dimensions)
   - Ranking score = dot product of user vector and post vector
   - Train via Alternating Least Squares (can run in Node.js with ml-matrix)

   **Option D: Graph Neural Networks (advanced)**
   - Model the social graph + interaction graph as a GNN
   - Propagate signals through the graph
   - Requires Python + PyTorch Geometric
   - Most powerful but needs dedicated ML infrastructure

3. **Implementation (Option A — Item-based CF)**

   ```sql
   -- New table
   CREATE TABLE post_similarities (
     post_id UUID REFERENCES posts(id),
     similar_post_id UUID REFERENCES posts(id),
     similarity_score FLOAT,
     computed_at TIMESTAMPTZ DEFAULT NOW(),
     PRIMARY KEY (post_id, similar_post_id)
   );

   -- RPC to compute similarities (run daily)
   CREATE FUNCTION compute_post_similarities(p_min_interactions INT DEFAULT 5)
   RETURNS void AS $$
     -- Cosine similarity between posts based on user engagement overlap
     -- Posts that are liked/replied by the same users are similar
   $$ LANGUAGE plpgsql;
   ```

   At feed time:
   - Get user's recently liked posts (last 50)
   - Find similar posts via `post_similarities`
   - Add `collaborative_score` as a new feature in the ranking model

4. **New Feature for Ranking**
   ```typescript
   // Add to PostFeatureVector
   collaborative_score: number;  // 0-1, how similar this post is to user's past engagement
   ```

5. **Files to Create**
   ```
   src/lib/feed/collaborative-filter.ts   # Compute and query post similarities
   supabase/migrations/003_collaborative_filtering.sql  # Tables + RPC
   scripts/compute-similarities.ts        # Offline job to refresh similarities
   ```

---

### Upgrade 4: Embedding-Based Similarity (Vector Search)

**Priority:** MEDIUM | **Impact:** Precise content matching | **Complexity:** Medium

**What Instagram Does:**
- Every post and user profile has a dense vector embedding (768-1536 dimensions)
- Similarity = cosine distance between vectors
- Powers "More like this", topic clustering, content deduplication

**What Ments Currently Does:**
- Keyword matching and topic tag overlap (discrete, not continuous)
- No dense vector representations

**Implementation Plan:**

1. **Generate Embeddings**
   - Use an embedding model to convert post content to vectors
   - Options:
     - **Supabase pgvector** (built-in!) — store and query vectors in PostgreSQL
     - **OpenAI text-embedding-3-small** — 1536 dimensions, $0.00002/1K tokens
     - **Groq** — doesn't offer embeddings yet, but may in future
     - **Hugging Face Inference API** — free tier, various models

2. **Supabase pgvector Setup**
   ```sql
   -- Enable the extension
   CREATE EXTENSION IF NOT EXISTS vector;

   -- Add embedding column to content_embeddings
   ALTER TABLE content_embeddings ADD COLUMN embedding vector(1536);

   -- Create index for fast similarity search
   CREATE INDEX ON content_embeddings
     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

   -- User interest embeddings
   ALTER TABLE user_interest_profiles ADD COLUMN interest_embedding vector(1536);

   -- Similarity search function
   CREATE FUNCTION find_similar_posts(
     p_embedding vector(1536),
     p_limit INT DEFAULT 50
   ) RETURNS TABLE(post_id UUID, similarity FLOAT) AS $$
     SELECT post_id, 1 - (embedding <=> p_embedding) as similarity
     FROM content_embeddings
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> p_embedding
     LIMIT p_limit;
   $$ LANGUAGE sql;
   ```

3. **Integration**
   - When a post is created: generate embedding, store in `content_embeddings.embedding`
   - When computing user profile: average embeddings of recently engaged posts → `interest_embedding`
   - At feed time: find posts with highest cosine similarity to user's interest embedding
   - Add as `embedding_similarity` feature to ranking model

4. **Files to Create**
   ```
   src/lib/feed/embeddings.ts             # Generate and store embeddings via API
   supabase/migrations/004_vector_search.sql  # pgvector setup
   ```

5. **Files to Modify**
   ```
   src/lib/feed/feature-extractor.ts      # Add embedding_similarity feature
   src/lib/feed/candidate-generator.ts    # Use vector search for candidate sourcing
   src/app/api/feed/extract-topics/route.ts  # Also generate embedding on post creation
   ```

---

### Upgrade 5: Exploration vs Exploitation (Contextual Bandits)

**Priority:** MEDIUM | **Impact:** Prevents filter bubbles, discovers new interests | **Complexity:** Medium

**What Instagram Does:**
- Balances showing content the user will definitely like (exploitation) vs. content they might discover and love (exploration)
- Uses Thompson Sampling or Upper Confidence Bound (UCB) algorithms
- Gradually introduces new topics, creators, and content types
- Adapts exploration rate based on user behavior (new users get more exploration)

**What Ments Currently Does:**
- Pure exploitation: ranks by predicted engagement, always shows "safe" content
- No mechanism to introduce new topics or break filter bubbles
- New creator boost (1.2x) is a basic form of exploration, but static

**Implementation Plan:**

1. **Epsilon-Greedy (Simplest — Start Here)**
   - With probability `epsilon` (e.g., 10%), show a random post from outside the user's usual interests
   - With probability `1 - epsilon`, show the top-ranked post
   - Decrease epsilon as the user scrolls deeper in the feed

   ```typescript
   // In reranker.ts, after diversity rules:
   function applyExploration(scored: ScoredPost[], userProfile: UserInterestProfile): ScoredPost[] {
     const epsilon = 0.10; // 10% exploration rate
     const result: ScoredPost[] = [];
     const explorationPool = scored.filter(p => p.features.topic_overlap_score < 0.2);

     for (const post of scored) {
       if (Math.random() < epsilon && explorationPool.length > 0) {
         // Inject an exploration post
         const explorePost = explorationPool.splice(
           Math.floor(Math.random() * explorationPool.length), 1
         )[0];
         result.push(explorePost);
       }
       result.push(post);
     }
     return result;
   }
   ```

2. **Thompson Sampling (Better)**
   - For each post, maintain a Beta distribution of engagement probability
   - Sample from the distribution (not just the mean) for ranking
   - Posts with uncertain engagement get boosted (high variance = more exploration)
   - As we observe more data, the distribution tightens (less exploration for known content)

   ```typescript
   // Beta distribution parameters per topic
   interface TopicBandit {
     topic: string;
     alpha: number; // successes (engagements)
     beta: number;  // failures (impressions without engagement)
   }

   function thompsonSample(alpha: number, beta: number): number {
     // Sample from Beta(alpha, beta)
     // Use jStat or simple approximation
     return betaSample(alpha, beta);
   }
   ```

3. **Contextual Bandits (Advanced)**
   - Exploration rate depends on context: time of day, session depth, user activity level
   - New users: 20% exploration (still discovering interests)
   - Power users: 5% exploration (well-established preferences)
   - Late-night sessions: 15% exploration (users more open to discovery)

4. **Tracking Exploration Effectiveness**
   - Tag exploration posts in `feed_events.metadata: { is_exploration: true }`
   - Track engagement rate on exploration vs exploitation posts
   - Monitor topic diversity per user over time
   - Dashboard metric: "% of engaged exploration posts" (should be > 5% for good recommendations)

5. **Files to Create**
   ```
   src/lib/feed/exploration.ts      # Bandit algorithms (epsilon-greedy, Thompson)
   src/lib/feed/bandit-state.ts     # Load/save bandit parameters per user
   ```

6. **New Table**
   ```sql
   CREATE TABLE user_exploration_state (
     user_id UUID PRIMARY KEY REFERENCES auth.users(id),
     topic_bandits JSONB DEFAULT '{}',  -- topic → {alpha, beta}
     exploration_rate FLOAT DEFAULT 0.10,
     total_explorations INT DEFAULT 0,
     successful_explorations INT DEFAULT 0,
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

---

### Upgrade 6: Negative Feedback Signals

**Priority:** MEDIUM | **Impact:** Reduces bad recommendations | **Complexity:** Small

**What Instagram Does:**
- Tracks "Not Interested", "Hide", "Report", "Unfollow" actions
- Heavily penalizes similar content after negative feedback
- Uses negative signals to retrain ranking models
- "See fewer posts like this" feature

**What Ments Currently Does:**
- Only tracks `unlike` as a negative signal (weight -1.0)
- No "not interested" or "hide" functionality

**Implementation Plan:**

1. **New Client Actions**
   ```typescript
   // Add to FeedEventType
   'not_interested' | 'hide_post' | 'mute_author' | 'report'
   ```

2. **UI Components**
   - Post overflow menu (three dots): "Not interested", "Hide this post", "Mute @author"
   - On action: remove post from feed with animation, track event

3. **Ranking Impact**
   ```typescript
   // Event weights
   not_interested: -3.0,  // Strong negative signal for similar content
   hide_post: -5.0,       // Remove from feed + penalize similar
   mute_author: -10.0,    // Never show this author again
   report: -10.0,         // Block + report
   ```

4. **Pipeline Integration**
   - During candidate generation: filter out posts from muted authors
   - During feature extraction: add `negative_signal_penalty` feature
   - Topics of "not interested" posts get negative weight in user's interest profile

5. **Files to Create**
   ```
   src/lib/feed/negative-signals.ts       # Process negative feedback
   src/components/posts/PostOverflowMenu.tsx  # "Not interested" UI
   ```

---

### Upgrade 7: Real-Time Interest Adaptation

**Priority:** LOW | **Impact:** Faster personalization | **Complexity:** Medium

**What Instagram Does:**
- Updates user interests in real-time as they interact within a session
- If you like 3 food posts in a row, immediately boosts food content
- Session-level interest modifiers on top of long-term profile

**What Ments Currently Does:**
- Interest profiles are recomputed every 1 hour (stale for fast interactions)
- No session-level interest adaptation

**Implementation Plan:**

1. **Session Interest Buffer**
   - Track engagement topics within the current session
   - Build a temporary interest boost vector
   - Apply on top of the long-term profile at ranking time

2. **Implementation**
   ```typescript
   interface SessionInterests {
     sessionId: string;
     topicBoosts: Record<string, number>;  // topic → engagement count this session
     authorBoosts: Record<string, number>; // author → interaction count this session
     contentTypeBoosts: Record<string, number>; // text/media/poll → count
   }
   ```

3. **Blending**
   ```
   effective_topic_score = 0.7 * long_term_profile + 0.3 * session_interests
   ```

4. **Files to Create**
   ```
   src/lib/feed/session-interests.ts    # Track and blend session-level interests
   ```

---

### Upgrade 8: Multi-Objective Optimization

**Priority:** LOW | **Impact:** Balances engagement with platform health | **Complexity:** Large

**What Instagram Does:**
- Optimizes for multiple objectives simultaneously:
  - Engagement (likes, comments, shares)
  - Time well spent (meaningful interactions, not just scrolling)
  - Creator fairness (distribute reach fairly among creators)
  - Content diversity (variety of topics, formats, creators)
  - Platform health (reduce misinformation, hate speech, clickbait)
- Uses Pareto-optimal ranking to balance these objectives

**What Ments Currently Does:**
- Single objective: maximize engagement score
- Diversity rules as hard constraints (not optimized)

**Implementation Plan:**

1. **Define Objectives**
   ```typescript
   interface RankingObjectives {
     engagement: number;        // P(like) + P(comment) + P(share)
     time_well_spent: number;   // P(dwell > 30s) + P(meaningful_reply)
     creator_fairness: number;  // Gini coefficient of creator reach
     content_diversity: number; // Entropy of topics in top-20
     platform_health: number;   // 1 - P(report) - P(negative_feedback)
   }
   ```

2. **Scalarization**
   Combine objectives into a single score with tunable weights:
   ```
   final_score = w1*engagement + w2*time_well_spent + w3*creator_fairness
               + w4*content_diversity + w5*platform_health
   ```

   Use A/B testing to find optimal weight balance.

3. **Creator Fairness**
   - Track impression distribution across creators
   - Boost under-served creators, cap over-served ones
   - Ensure new creators get minimum exposure

---

### Upgrade 9: Ads Ranking Integration (Monetization)

**Priority:** LOW (until monetization) | **Impact:** Revenue | **Complexity:** Large

**When to Implement:** After reaching ~10K DAU

**Overview:**
- Separate ads ranking model: P(click) * bid_amount
- Ads inserted at fixed positions (every 5th post)
- Frequency capping (same ad max 3 times per day)
- Relevance filtering (ads must meet minimum relevance threshold)
- A/B test ad load (number of ads per session)

**Files to Create (future)**
```
src/lib/feed/ads/
├── ad-ranker.ts          # Rank ads by expected revenue * relevance
├── ad-injector.ts        # Insert ads at optimal positions
├── frequency-cap.ts      # Track and enforce ad frequency limits
└── ad-types.ts           # Ad format definitions
```

---

### Implementation Priority Order

| Phase | Upgrade | Timeline | Prerequisites |
|-------|---------|----------|---------------|
| **Phase 1** | Negative Feedback Signals (#6) | 1-2 weeks | None — easiest win |
| **Phase 2** | Collaborative Filtering (#3) | 2-3 weeks | Need ~10K feed_events |
| **Phase 3** | Image Understanding (#2) | 1-2 weeks | Groq Vision API key |
| **Phase 4** | ML Prediction Model (#1) | 3-4 weeks | Need ~50K feed_events |
| **Phase 5** | Vector Embeddings (#4) | 2-3 weeks | pgvector extension enabled |
| **Phase 6** | Exploration/Exploitation (#5) | 2-3 weeks | ML model from Phase 4 |
| **Phase 7** | Real-Time Adaptation (#7) | 1-2 weeks | Phase 4 model |
| **Phase 8** | Multi-Objective (#8) | 3-4 weeks | All above |
| **Phase 9** | Ads Integration (#9) | 4-6 weeks | 10K+ DAU |

### Data Milestones

| Milestone | Unlocks |
|-----------|---------|
| 10K feed_events | Basic collaborative filtering |
| 50K feed_events | ML engagement prediction model (useful) |
| 500K feed_events | ML model (good), vector embeddings |
| 1M feed_events | Advanced bandits, multi-objective optimization |
| 10K DAU | Ads integration viable |

### Infrastructure Milestones

| Current | When to Upgrade | What to Add |
|---------|----------------|-------------|
| Supabase PostgreSQL | 100K+ posts | Enable pgvector extension |
| Groq LLM (free tier) | 10K+ daily rankings | Groq paid plan or Replicate |
| Vercel Serverless | 50ms+ ranking latency | Edge functions or dedicated ML endpoint |
| No ML infra | 50K+ training examples | Python training pipeline (GitHub Actions) |
| Single region | Global users | Multi-region Supabase + Vercel Edge |
