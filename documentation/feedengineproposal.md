# Feed Engine Proposal — 5 Levels of Complexity

> A practical roadmap from "fix what's broken" to "Twitter-grade ranking", with cost and latency estimates at each level.

---

## Current State (Baseline)

Before proposing changes, here's where we stand:

```
What works:           Tier 1 weighted scoring, diversity rules, cache (2hr TTL), event batching
What's broken:        GROQ_API_KEY missing (Tier 2 off), no background jobs, scoring tables empty
What's missing:       Redis, embedding pipeline, cron jobs, rate limiting, circuit breakers
Current stack:        Next.js + Supabase self-hosted on AWS (EC2 + Postgres on EC2) + Groq (disabled)
Current infra:        1× t3.medium EC2 (Supabase + Postgres co-located) — dev setup
Prod plan:            EC2 (t3.medium) + RDS PostgreSQL (db.t3.medium)
Current cost:         ~$30/mo (1× t3.medium on-demand)
Prod baseline cost:   ~$100/mo (EC2 ~$30 + RDS ~$65 + EBS/transfer ~$5)
Current latency:      Unknown (likely chronological fallback every time)
Estimated scale:      <1K DAU, early beta
```

**Per-request cost today (when working):**
- Cache hit: 2 DB queries → ~$0.00001
- Cache miss: 8 DB queries + 1 Groq call → ~$0.0003
- Groq (llama-3.3-70b): $0.59/M input + $0.79/M output tokens

---

## Level 1 — Fix & Stabilize (What Beta Should Launch With)

> Goal: Make the existing pipeline actually work end-to-end.

### Changes

1. **Fix environment variables**
   - Add `GROQ_API_KEY` to `.env`
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is accessible server-side

2. **Add 3 Supabase cron jobs** (via pg_cron or Supabase Dashboard → Database → Extensions)
   ```sql
   -- Every 15 minutes: refresh post engagement scores
   SELECT cron.schedule('refresh-post-features', '*/15 * * * *',
     $$SELECT compute_post_features(p.id) FROM posts p
       WHERE p.created_at > now() - interval '3 days' AND p.deleted = false$$
   );

   -- Every hour: refresh active user interest profiles
   SELECT cron.schedule('refresh-interest-profiles', '0 * * * *',
     $$SELECT compute_user_interest_profile(s.user_id)
       FROM user_sessions s
       WHERE s.last_active_at > now() - interval '24 hours'
       GROUP BY s.user_id$$
   );

   -- Every 30 minutes: extract topics for new posts
   SELECT cron.schedule('extract-topics', '*/30 * * * *',
     $$INSERT INTO content_embeddings (post_id, topics, keywords, sentiment_score)
       SELECT p.id, '{}', '{}', 0
       FROM posts p
       LEFT JOIN content_embeddings ce ON ce.post_id = p.id
       WHERE ce.post_id IS NULL AND p.deleted = false
       LIMIT 50$$
   );
   ```

3. **Add pipeline-level logging** — structured logs with timing for each stage
4. **Add timeout to Groq calls** — 3 second max, fall back to Tier 1
5. **Fix realtime-injector** `is_following` hardcode — query actual follow status

### Architecture

```
                  Same as today, but actually running
                  ===================================

Client → GET /api/feed → Pipeline → [Candidates] → [Features] → [Tier1] → [Groq] → [Diversity]
                              ↑                          ↑
                          pg_cron fills              pg_cron fills
                          post_features          interest_profiles
```

### Cost

| Item | Monthly Cost (Dev) | Monthly Cost (Prod) |
|------|-------------------|---------------------|
| AWS EC2 t3.medium (Supabase) | $30 | $30 |
| Postgres (on same EC2 / RDS) | (included) | $65 (db.t3.medium RDS) |
| EBS storage + data transfer | ~$2 | ~$5 |
| Groq API (est. 5K feed loads/mo, 20% miss = 1K calls) | ~$0.30 | ~$0.30 |
| pg_cron (Postgres extension, free) | $0 | $0 |
| **Total** | **~$32** | **~$100** |

### Latency

| Scenario | Expected |
|----------|----------|
| Cache hit (80% of requests) | 50–150ms |
| Cache miss (full pipeline) | 1–3s (Groq is the bottleneck) |
| Chronological fallback | 50–100ms |

### What This Gets You
- Personalized feed actually works
- Engagement scores are fresh (15min)
- User profiles update hourly
- Groq re-ranking live with 3s timeout safety net

---

## Level 2 — Smart Caching & Keyword Embeddings

> Goal: Sub-100ms responses, real topic matching, proper observability.

### Changes on top of Level 1

1. **Add Upstash Redis** for feed cache + interest profiles
   - Feed cache: Redis sorted set per user (post_id → score)
   - Interest profile: Redis hash per user
   - TTL: 2 hours (feed), 1 hour (profile)
   - Eliminates DB round-trip for 80%+ of requests

2. **Keyword-based topic extraction on post creation**
   - Use the existing fallback keyword extractor (no API cost)
   - Run synchronously in the `POST /api/posts` route
   - Covers 8 topic categories already mapped in `topic-extractor.ts`

3. **Interaction graph updates on event flush**
   - When `POST /api/feed/events` receives likes/replies/shares
   - Call `update_interaction_graph` for those specific user-author pairs
   - Currently this is "fire and forget" — make it reliable with retry

4. **Add Vercel Cron** for daily analytics aggregation
   ```
   /api/cron/feed-analytics → aggregate feed_events into feed_analytics_daily
   /api/cron/trending        → compute trending_topics from recent engagement
   ```

5. **Add structured pipeline timing**
   ```typescript
   // Log per-stage timing on every pipeline run
   { stage: "candidates", duration_ms: 120, count: 187 }
   { stage: "features", duration_ms: 85, count: 187 }
   { stage: "tier1", duration_ms: 3, count: 187 }
   { stage: "groq", duration_ms: 1400, count: 50 }
   { stage: "diversity", duration_ms: 1, count: 187 }
   ```

### Architecture

```
Client → GET /api/feed
              ↓
         [Redis Cache] ──hit──→ Return immediately (5-20ms)
              ↓ miss
         [Pipeline]
              ↓
         [Candidates → Features → Tier1 → Groq → Diversity]
              ↓
         Write to Redis + Postgres cache
              ↓
         Return feed

Background:
  pg_cron      → post_features, interest_profiles
  Vercel Cron  → daily analytics, trending topics
  On post create → keyword extraction (sync)
  On event flush → interaction graph update
```

### Cost

| Item | Monthly Cost (Dev) | Monthly Cost (Prod) |
|------|-------------------|---------------------|
| AWS EC2 + Postgres (same as L1) | $32 | $100 |
| Upstash Redis (free tier: 500K commands) | $0 | $0 |
| Groq API | ~$0.30 | ~$0.30 |
| Vercel Cron (included in Vercel plan) | $0 | $0 |
| **Total** | **~$32** | **~$100** |

At 10K DAU the Redis free tier still holds (~300K commands/mo for feed lookups).

### Latency

| Scenario | Expected |
|----------|----------|
| Redis cache hit | 5–20ms |
| Postgres cache hit (Redis miss) | 50–100ms |
| Full pipeline | 1–3s |

### What This Gets You
- Near-instant feed loads for returning users
- Trending topics actually populated
- Analytics dashboard works
- Topic matching works (keyword-based, not semantic yet)
- Observable pipeline with per-stage metrics

---

## Level 3 — Semantic Understanding

> Goal: The feed actually "understands" what posts are about and matches them to user interests using vector similarity.

### Changes on top of Level 2

1. **Vector embeddings for posts**
   - On post creation: call OpenAI `text-embedding-3-small` (1536 dims)
   - Store in Supabase `pgvector` extension
   - Cost: $0.02/M tokens → ~$0.001 for 100 posts/day

2. **User interest vector** (computed, not stored)
   - Weighted average of post vectors the user engaged with
   - Weights = event weights (reply 5.0, like 3.0, etc.)
   - Recomputed hourly alongside interest profile
   - Stored as a single 1536-dim vector per user in Redis

3. **Replace topic_overlap_score with cosine similarity**
   ```typescript
   // Old: keyword matching (binary, shallow)
   topicOverlap = matchingKeywords.length / 3;

   // New: semantic similarity (continuous, deep)
   topicOverlap = cosineSimilarity(userVector, postVector);
   // "AI startup pitch deck" matches "seed round fundraising" → 0.82
   // Old keyword approach would score this 0.0
   ```

4. **Groq prompt enrichment**
   - Send the user's top 5 topics + their semantic cluster labels
   - Include post sentiment scores in the re-rank prompt
   - Better LLM context = better re-ranking

5. **Content quality scoring via LLM**
   - On post creation: ask Groq to rate content quality 0-1
   - Factors: clarity, originality, actionability, depth
   - Stored in `post_features.content_quality`
   - Currently hardcoded to 0.5 for all posts

### Architecture

```
On Post Create:
  POST /api/posts → [Save post] → [Generate embedding (OpenAI)] → [Score quality (Groq)]
                                         ↓
                                  pgvector store

On Feed Request:
  Client → Redis → miss → Pipeline
                            ↓
                     [Candidates]
                            ↓
                     [Feature Extraction]
                       + cosine similarity (pgvector <=> operator)
                            ↓
                     [Tier1] → [Groq rerank] → [Diversity]

Hourly Cron:
  Recompute user interest vectors from engagement-weighted post embeddings
```

### Cost

| Item | Monthly Cost (Dev) | Monthly Cost (Prod) |
|------|-------------------|---------------------|
| AWS EC2 + Postgres (same as L1) | $32 | $100 |
| Upstash Redis | $0 | $0–10 |
| Groq API (feed re-ranking) | ~$0.30 | ~$0.30 |
| Groq API (content quality on create, ~100 posts/day) | ~$0.50 | ~$0.50 |
| OpenAI embeddings (100 posts/day × 500 tokens avg) | ~$0.03 | ~$0.03 |
| **Total** | **~$33** | **~$101–111** |

### Latency

| Scenario | Expected |
|----------|----------|
| Redis hit | 5–20ms |
| Pipeline with pgvector | 1.5–3.5s |
| pgvector similarity query (1536 dims, 200 posts) | 5–15ms |
| Embedding on post create | 100–200ms (async, non-blocking) |

### What This Gets You
- Posts about "raising a seed round" match users interested in "startup funding" even with zero keyword overlap
- Content quality is real, not a 0.5 placeholder
- Semantic clusters emerge naturally (tech founders, designers, VCs, etc.)
- Foundation for collaborative filtering in Level 4

---

## Level 4 — Lightweight ML + Collaborative Filtering

> Goal: The feed learns from collective behavior, not just individual signals. "Users like you also liked..."

### Changes on top of Level 3

1. **Collaborative filtering via implicit ALS**
   - Build a user-post interaction matrix from `feed_events`
   - Use lightweight ALS (Alternating Least Squares) — runs in a Supabase Edge Function or a small serverless worker
   - Produces per-user recommendation scores for unseen posts
   - Recomputed nightly

2. **Replace Tier 1 weighted formula with a learned model**
   - Train a logistic regression or small gradient-boosted model on:
     - Input: the 18 feature vectors
     - Label: did the user engage? (like/reply/share = 1, scroll_past = 0)
   - Export as a JSON weight file (no ML runtime needed)
   - Update weekly from accumulated event data
   - Scoring is still just a dot product — same speed as the current formula but weights are learned, not hand-tuned

3. **Multi-armed bandit for exploration**
   - Reserve 10% of feed slots for "exploration" posts
   - Posts the user hasn't been exposed to from new or diverse creators
   - Use Thompson Sampling to balance exploit (high-score posts) vs explore (uncertain posts)
   - Prevents filter bubbles

4. **Engagement prediction model**
   - Predict P(engage | user, post) for each candidate
   - Blend with Tier 1 score: `final = 0.6 * tier1 + 0.4 * P(engage)`
   - The predicted probability accounts for non-linear interactions between features

5. **Segment-level Groq caching**
   - Cluster users into ~50 behavioral segments (from ALS user vectors)
   - Cache Groq re-ranking results per segment (not per user)
   - 50 Groq calls/hour serves all users instead of 1 per cache miss

### Architecture

```
Nightly Batch (Edge Function or Worker):
  [feed_events] → ALS matrix factorization → user_factors + item_factors
  [feed_events] → logistic regression training → scoring_weights.json

On Feed Request:
  Client → Redis
         ↓ miss
  [Candidates] ← include ALS recommendations (collaborative)
         ↓
  [Features + ALS score + P(engage)]
         ↓
  [Learned Scorer] (dot product with trained weights)
         ↓
  [Groq rerank (segment-cached)]
         ↓
  [Diversity + Exploration slots (10%)]
         ↓
  Redis + Postgres cache
```

### Cost

| Item | Monthly Cost (Dev) | Monthly Cost (Prod) |
|------|-------------------|---------------------|
| AWS EC2 + Postgres/RDS | $32 | $100 |
| Upstash Redis (Pro, ~1M commands) | $10 | $10 |
| Groq API (segment-cached, ~50 segments × 24 recomputes) | ~$1 | ~$1 |
| OpenAI embeddings | ~$0.03 | ~$0.03 |
| AWS Lambda / worker for nightly ML | $0–2 | $0–5 |
| **Total** | **~$43–45** | **~$111–116** |

### Latency

| Scenario | Expected |
|----------|----------|
| Redis hit | 5–20ms |
| Full pipeline (learned scorer, no Groq) | 300–800ms |
| Full pipeline (with Groq, cache miss) | 1–2.5s |

### What This Gets You
- Feed improves automatically from collective user behavior
- Scoring weights are learned from real data, not guessed
- Exploration prevents echo chambers
- Groq costs drop 95% via segment caching
- New users get reasonable feeds from collaborative signals even with no personal history (cold start solved)

---

## Level 5 — Production-Grade Ranking System

> Goal: Twitter/LinkedIn-grade feed ranking. Real-time feature store, multi-model ensemble, online learning.

### Changes on top of Level 4

1. **Dedicated feature store** (Upstash Redis + DynamoDB or Supabase Realtime)
   - Pre-computed features available in <5ms
   - Updated in real-time as events stream in
   - Features: post engagement velocity (last 5min, 1hr, 24hr), user session context, time-of-day preferences, device type preferences

2. **Multi-model ensemble**
   ```
   Candidate retrieval:    ANN (Approximate Nearest Neighbor) over pgvector
   Coarse ranking:         Learned logistic regression (fast, all candidates)
   Fine ranking:           Small neural net or XGBoost (top 100 only)
   Re-ranking:             LLM for top 30 (diversity + serendipity)
   Final:                  Business rules + exploration
   ```

3. **Online learning** — model updates in near-real-time
   - Every event batch updates a running gradient
   - Model weights shift within minutes of new engagement patterns
   - No more "wait for nightly retrain"

4. **Contextual features**
   - Time of day (users browse differently at 9am vs 11pm)
   - Device type (mobile users prefer shorter content)
   - Session depth (post #1 should be high-confidence, post #20 can explore)
   - Recency of last visit (returning after 2 days = show more catch-up content)

5. **Real-time trending with decay**
   - Sliding window engagement velocity
   - Trending posts injected with time-decaying boost
   - "Breaking" posts bypass cache entirely

6. **Full observability stack**
   - Per-user feed quality score (engagement rate, dwell time, session depth)
   - A/B experiment auto-analysis with statistical significance
   - Alerting on engagement drops
   - Shadow mode for testing new models (score but don't serve)

### Architecture

```
Real-time ingestion:
  Events → Supabase Realtime → Feature Store (Redis) → Online Model Update

Feed serving:
  Client → Feature Store (5ms) → ANN Retrieval (10ms) → Coarse Rank (5ms)
        → Fine Rank top 100 (20ms) → LLM Rerank top 30 (500ms) → Business Rules
        → Cache + Serve

Batch processing (hourly):
  [Events] → Model retrain → Deploy weights → A/B evaluation

Shadow scoring:
  New model scores in parallel → compare metrics → auto-promote if better
```

### Cost

| Item | Monthly Cost (Prod) |
|------|---------------------|
| AWS EC2 t3.large (Supabase + app) | $60 |
| AWS RDS db.t3.large (Postgres + pgvector) | $130 |
| EBS + data transfer | $10–15 |
| Upstash Redis Pro (5M+ commands) | $30–50 |
| Groq API (segment-cached + content scoring) | ~$5 |
| OpenAI embeddings | ~$0.50 |
| AWS Lambda / ECS worker for ML training | $10–25 |
| Monitoring (CloudWatch / Datadog free tier) | $0–20 |
| **Total** | **~$245–305** |

### Latency

| Scenario | Expected |
|----------|----------|
| Feature store hit + coarse rank | 15–30ms |
| Full pipeline (no LLM) | 50–100ms |
| Full pipeline (with LLM rerank) | 300–600ms |

### What This Gets You
- Sub-100ms feed serving for all users
- Models that improve within minutes of new behavior
- Twitter-grade relevance with startup-grade costs
- Full experimentation platform with auto-analysis
- No cold start problem (collaborative + contextual signals)

---

## Side-by-Side Comparison

```
                   Level 1       Level 2       Level 3       Level 4       Level 5
                   Fix &         Smart         Semantic      ML +          Production
                   Stabilize     Caching       Understanding Collaborative Grade
─────────────────────────────────────────────────────────────────────────────────────
Monthly Cost (dev) ~$32          ~$32          ~$33          ~$45          N/A
Monthly Cost (prod)~$100         ~$100         ~$111         ~$116         ~$275
─────────────────────────────────────────────────────────────────────────────────────
Latency (p50)      50-150ms      5-20ms        5-20ms        5-20ms        15-30ms
Latency (p99)      3s            3s            3.5s          2.5s          600ms
─────────────────────────────────────────────────────────────────────────────────────
Personalization    Follows +      + trending    + semantic    + collective  + contextual
Signals            engagement    + keywords     similarity    behavior      + real-time
─────────────────────────────────────────────────────────────────────────────────────
Cold Start         Poor          Poor          Moderate      Good          Excellent
─────────────────────────────────────────────────────────────────────────────────────
Scoring            Hand-tuned    Hand-tuned    Hand-tuned    Learned       Ensemble
                   weights       weights       weights       weights       (multi-model)
─────────────────────────────────────────────────────────────────────────────────────
Topic Matching     Keyword       Keyword       Vector        Vector +      Vector +
                   (shallow)     (shallow)     cosine        collaborative context
─────────────────────────────────────────────────────────────────────────────────────
LLM Usage          Per user      Per user      Per user      Per segment   Per segment
                   (expensive)   (expensive)   + enriched    (cheap)       + shadow
─────────────────────────────────────────────────────────────────────────────────────
Background Jobs    pg_cron       + Vercel Cron + embed on    + nightly ML  + online
                                              create        training      learning
─────────────────────────────────────────────────────────────────────────────────────
Scale ceiling      1K DAU        10K DAU       50K DAU       200K DAU      1M+ DAU
─────────────────────────────────────────────────────────────────────────────────────
Eng effort         1-2 days      3-5 days      1-2 weeks     3-4 weeks     2-3 months
```

---

## Recommendation for Beta Launch

### Ship Level 1 immediately (1-2 days of work)

It's the highest ROI move. The entire pipeline is built — it just needs the env vars fixed and cron jobs added. Zero architectural changes, zero new dependencies.

### Move to Level 2 within the first month

Adding Upstash Redis is a few hours of work and drops your p50 latency from 150ms to 20ms. The keyword extraction on post create fills the `content_embeddings` table so topic matching actually works. Both are free tier.

### Level 3 when you have 500+ active users

Vector embeddings only matter when you have enough content diversity that keyword matching isn't enough. Below 500 DAU, the keyword approach covers most cases. The OpenAI embedding cost is negligible ($0.03/mo at 100 posts/day) but the engineering effort is meaningful.

### Level 4 when you have 5K+ active users

Collaborative filtering needs a critical mass of interaction data. Below ~5K users, the interaction matrix is too sparse for ALS to produce useful recommendations. The learned scorer also needs enough training data (thousands of engage/skip pairs) to beat hand-tuned weights.

### Level 5 is a dedicated project

This is 2-3 months of focused engineering. Only pursue when feed quality is a proven retention driver and you have the team to maintain it. The infrastructure cost (~$150/mo) is reasonable, but the human cost of maintaining online learning, shadow scoring, and multi-model ensembles is significant.

---

## Beta Testing Strategy

### Metrics to Track (from day 1)

```
Primary metrics:
  - Feed engagement rate     = (likes + replies + shares) / impressions
  - Average dwell time       = mean time spent viewing posts (from dwell events)
  - Session depth            = how many posts users scroll through
  - Return rate              = % users who come back within 24 hours

Secondary metrics:
  - Content diversity score  = unique authors in top 20 / 20
  - Fresh content ratio      = posts <6hrs old in top 10 / 10
  - Groq success rate        = % of pipeline runs where Groq returned valid rerank
  - Pipeline latency (p50, p95, p99)
  - Cache hit rate
```

### A/B Testing Plan (use the existing experiment framework)

**Experiment 1: Personalized vs Chronological**
```json
{
  "name": "personalized_vs_chrono",
  "variants": [
    { "name": "control", "weight": 0.5, "config": {} },
    { "name": "chronological", "weight": 0.5, "config": { "force_chronological": true } }
  ]
}
```
Validates that the ranking pipeline is better than newest-first. If it's not, something is wrong.

**Experiment 2: Groq On vs Off**
```json
{
  "name": "groq_rerank",
  "variants": [
    { "name": "tier1_only", "weight": 0.5, "config": {} },
    { "name": "tier1_plus_groq", "weight": 0.5, "config": { "enable_groq": true } }
  ]
}
```
Validates that the LLM re-ranking improves engagement. If Tier 1 alone performs equally well, you can skip Groq entirely and save latency.

**Experiment 3: Weight Tuning**
```json
{
  "name": "weight_tuning_v1",
  "variants": [
    { "name": "control", "weight": 0.34, "config": {} },
    { "name": "social_heavy", "weight": 0.33, "config": { "following": 0.30, "interaction_affinity": 0.20 } },
    { "name": "content_heavy", "weight": 0.33, "config": { "topic_overlap": 0.20, "freshness": 0.15 } }
  ]
}
```
Tests whether users prefer social signals (posts from people they interact with) vs content signals (posts matching their interests).

### Minimum Data for Significance

Using the existing `statistics.ts` z-test/t-test:
- **Engagement rate** (proportion test): need ~1,000 impressions per variant for p<0.05
- **Dwell time** (t-test): need ~500 sessions per variant
- At 500 DAU with 50/50 split, you'll reach significance in **~2-4 days**

### Beta Rollout Plan

```
Week 1:  Ship Level 1, instrument all metrics, 100% personalized
         (Validate pipeline runs, no errors, feeds load)

Week 2:  Run Experiment 1 (personalized vs chronological)
         (Validate personalized beats chronological on engagement rate)

Week 3:  Run Experiment 2 (Groq on vs off)
         (Decide if Tier 2 is worth the latency hit)

Week 4:  Run Experiment 3 (weight tuning)
         (Find optimal weight configuration for your user base)

Week 5+: Ship Level 2 (Redis + background jobs)
         Begin Level 3 exploration based on experiment learnings
```

---

## FAQ

### Q: Is calling an LLM for every feed request insane? Won't it be slow and expensive?

Short answer: **cost is negligible, latency is the real concern — but it's solvable.**

Let's do the actual math. Here's what one re-rank call looks like:

```
INPUT (~1,620 tokens):
  System prompt:              ~100 tokens
  50 posts × 30 tokens each:  ~1,500 tokens
  User's top 5 interests:     ~20 tokens

OUTPUT (~200 tokens):
  JSON array of 50 short IDs
```

#### Cost per single re-rank call

| Model | Input cost | Output cost | **Total/call** |
|-------|-----------|------------|----------------|
| GPT-4.1 nano | $0.000162 | $0.000080 | **$0.00024** |
| Groq llama-3.3-70b | $0.000956 | $0.000158 | **$0.0011** |
| GPT-4.1 mini | $0.000648 | $0.000320 | **$0.00097** |
| GPT-4.1 | $0.00324 | $0.00160 | **$0.0048** |

That's fractions of a cent. Even GPT-4.1 (the expensive one) costs less than half a cent per feed load.

#### Monthly cost at scale (cache miss = 20% of feed loads)

Assumptions: each user loads feed 2×/day, 80% are cache hits, so only 20% trigger an LLM call.

| Model | 1K DAU (12K calls/mo) | 10K DAU (120K calls/mo) | 100K DAU (1.2M calls/mo) |
|-------|----------------------|------------------------|--------------------------|
| GPT-4.1 nano | **$2.90** | **$29** | **$290** |
| Groq llama-3.3-70b | **$13** | **$133** | **$1,330** |
| GPT-4.1 mini | **$12** | **$116** | **$1,160** |
| GPT-4.1 | **$58** | **$580** | **$5,800** |

**At beta scale (1K DAU), the LLM cost is $3-13/month. That's nothing.**

At 100K DAU it starts to matter — but by then you should be on Level 4 (segment-cached Groq: ~50 calls/hour instead of per-user), which drops it back to ~$5/mo regardless of user count.

#### Latency — this is the real problem

| Model | Time to first token | Output speed | **Total for 200 tokens** |
|-------|-------------------|-------------|--------------------------|
| Groq llama-3.3-70b | 0.24s | 276 tok/s | **~1.0s** |
| Groq speculative decoding | ~0.2s | 1,665 tok/s | **~0.3s** |
| GPT-4.1 nano | ~0.3s | ~150 tok/s | **~1.6s** |
| GPT-4.1 mini | ~0.5s | ~100 tok/s | **~2.5s** |
| GPT-4.1 | ~0.8s | ~80 tok/s | **~3.3s** |

**Groq is 2-3× faster than OpenAI for this use case.** That's why the current code uses Groq, not OpenAI.

But even Groq adds ~1 second to the pipeline. Combined with candidate generation (~300ms) and feature extraction (~200ms), total pipeline time is ~1.5s on a cache miss. That's noticeable.

#### So is the LLM call worth it?

Here's the honest assessment:

```
What the LLM sees:         Top 5 interest keywords + 100 chars per post + metadata
What Tier 1 already knows: Full feature vector (18 dimensions), interaction history, follow graph

The LLM adds:
  ✓ Semantic matching     ("seed round" matches "startup funding" interest)
  ✓ Diversity enforcement (no 2 from same author in top 10)
  ✓ Content understanding (knows a joke post ≠ a technical post)

The LLM does NOT add:
  ✗ User history awareness (doesn't know your interaction patterns)
  ✗ Engagement prediction (doesn't know this type of post gets clicks)
  ✗ Temporal context (doesn't know what time of day you browse)
```

**For beta: Tier 1 alone is probably good enough.** The LLM's main advantage (semantic matching) can be replicated cheaper and faster at Level 3 with vector embeddings (~5ms, $0.03/mo). The diversity enforcement it does is already handled by the reranker stage.

**Recommendation:** Launch with Tier 1 only. Run the "Groq on vs off" A/B experiment (Week 3 in the beta plan). If engagement rate doesn't improve by at least 5%, skip Groq entirely and put that engineering effort into Level 3 embeddings instead.

#### What about GPT-4.1 nano as a Groq replacement?

| | Groq llama-3.3-70b | GPT-4.1 nano |
|---|---|---|
| Cost/call | $0.0011 | $0.00024 (4.5× cheaper) |
| Latency | ~1.0s | ~1.6s (60% slower) |
| Quality | Good (70B model) | Lower (nano = smallest model) |
| Batch API | No | Yes (50% cheaper, but async) |

GPT-4.1 nano is cheaper but slower and lower quality. For real-time feed ranking, Groq's speed advantage matters more than nano's cost advantage (both are pennies). If you move to segment-caching (Level 4), the calls happen in background anyway, so latency doesn't matter — then nano at $0.00024/call with batch API ($0.00012/call) becomes the obvious choice.

---

### Q: What if we skip the LLM entirely and just use the math scoring?

**Totally viable for beta.** Tier 1 already accounts for:
- Who you follow (20% weight)
- How much you interact with each creator (15%)
- Post engagement metrics (15%)
- Topic relevance via keywords (10%)
- Freshness (10%)
- Content type preferences (3%)

That covers 80% of what makes a feed feel personal. The remaining 20% (semantic understanding + serendipity) is what the LLM adds — nice-to-have, not essential at <10K users.

The pipeline without Groq runs in **200-500ms** instead of **1-3s**. That's a better user experience than a slightly smarter ordering.

---

### Q: Won't the feed engine tables (post_features, content_embeddings, etc.) eat up database storage?

At beta scale, no. Here's the math:

| Table | Row size | At 10K posts | At 100K posts |
|-------|---------|-------------|---------------|
| post_features | ~200 bytes | 2 MB | 20 MB |
| content_embeddings (keywords) | ~500 bytes | 5 MB | 50 MB |
| content_embeddings (pgvector 1536d) | ~6 KB | 60 MB | 600 MB |
| feed_events | ~150 bytes | 50 MB (at 10K DAU) | 500 MB |
| feed_cache | ~2 KB per user | 2 MB (1K users) | 20 MB |
| user_interest_profiles | ~1 KB | 1 MB | 10 MB |

Without pgvector embeddings (Levels 1-2): **total ~60 MB at 10K posts**. Your t3.medium has 4 GB RAM — this fits entirely in Postgres cache.

With pgvector (Level 3+): add ~600 MB at 100K posts. Still fits, but you'd want an index (IVFFlat or HNSW) and may need to bump to t3.large at that scale.

---

### Q: What happens when the feed engine is completely down?

The pipeline is designed to never crash the feed. Every stage is wrapped in try/catch:

```
Pipeline fails?     → API route serves chronological (newest first)
Groq fails?         → Tier 1 scoring used as-is
Cache fails?        → Full pipeline runs (slower but works)
RPC fails?          → Fallback SQL query
Interest profile?   → null (feed still works, just not personalized)
```

Users always see posts. The worst case is a chronological feed — which is what most apps ship as their only option anyway.

---

## Pricing Sources & Assumptions

**AWS (self-hosted Supabase):**
- EC2 t3.medium on-demand: ~$30/mo ($0.0416/hr)
- EC2 t3.large on-demand: ~$60/mo ($0.0832/hr)
- RDS db.t3.medium PostgreSQL: ~$65/mo (single-AZ, 20GB gp3)
- RDS db.t3.large PostgreSQL: ~$130/mo (single-AZ, 50GB gp3)
- Reserved Instances can cut these 30-40%
- Source: [AWS Pricing Calculator](https://calculator.aws/)

**APIs:**
- [Groq Pricing](https://groq.com/pricing) — $0.59/M input, $0.79/M output for llama-3.3-70b (276 tok/s)
- [OpenAI Pricing](https://openai.com/api/pricing/) — GPT-4.1 nano: $0.10/M in, $0.40/M out · GPT-4.1 mini: $0.40/M in, $1.60/M out · GPT-4.1: $2.00/M in, $8.00/M out
- [Groq Benchmarks](https://groq.com/blog/new-ai-inference-speed-benchmark-for-llama-3-3-70b-powered-by-groq/) — 276 tok/s standard, 1,665 tok/s speculative decoding
- [Upstash Redis](https://upstash.com/pricing/redis) — Free: 500K commands/mo, Pay-as-you-go: $0.20/100K commands
- [OpenAI Embeddings](https://costgoat.com/pricing/openai-embeddings) — text-embedding-3-small: $0.02/M tokens
- [Cohere Embed](https://cohere.com/pricing) — Embed v4: $0.12/M tokens (alternative)

**Note:** All AWS costs assume on-demand pricing in us-east-1. With 1-year Reserved Instances, prod costs drop ~30% (e.g. Level 1 prod: ~$100 → ~$70).
