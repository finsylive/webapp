# Level 2 Feed Engine — Plain English Guide

> No code. No jargon. Just what it is, how it works, and why it matters.

---

## The One-Line Summary

Level 2 takes the feed engine from "technically built but not really working" to "actually fast, actually smart, actually personalized" — without changing how it ranks posts, just making the infrastructure underneath it run properly.

---

## First, What Is a Feed Engine?

Every time you open the Ments app and see posts, something had to decide:
- Which posts out of potentially hundreds to show you
- What order to put them in
- What to put at the top

That decision-making system is the feed engine. Right now it exists in code but several key parts of it are either broken or never get the data they need to work. Level 2 fixes that.

---

## What Are Interest Profiles? (The Intuitive Explanation)

### Think of it like a music app learning your taste

When you first open Spotify, it doesn't know anything about you. It shows you generic popular stuff. After a week of listening, it knows you love jazz, tend to listen in the evenings, skip electronic music, and replay certain artists. Now the Discover Weekly playlist feels like it was made for you.

**Your interest profile is exactly that — but for posts.**

Every time you interact with a post on Ments, the system silently takes a note:

```
You liked a post about fundraising?
  → "This person is probably interested in startup funding"

You replied to a post about building a product?
  → "This person really cares about product — a reply is a strong signal"

You scrolled past 5 posts in a row about NFTs without slowing down?
  → "This person probably doesn't care about crypto"

You spent 8 seconds reading a post about design systems before moving on?
  → "Moderate interest in design"
```

Over time, these notes build into a profile that looks roughly like:

```
Topics you care about (scored 0-10):
  Startups:       8.5   ← you engage with this a lot
  AI & Tech:      7.2
  Product:        6.8
  Design:         3.1   ← mild interest
  Career:         2.0   ← rarely engage

Creators you interact with most:
  @alice_founder:  12.5  ← you reply to her often
  @bob_designer:   8.3

How you browse:
  Average time per post: 3.5 seconds
  You typically scroll ~25 posts per session
  You're most active at 9am, noon, and 8pm
  You prefer media posts over plain text
```

### The scoring is not equal — actions speak differently

Not all your interactions count the same. Replying to something means you were really engaged. Just seeing it scroll past means almost nothing.

```
Action              How much it teaches the system
──────────────────────────────────────────────────
You reply           A LOT — you thought hard enough to write something
You share           A LOT — you wanted others to see it
You like/bookmark   Quite a bit — deliberate positive action
You vote in a poll  Decent signal — you participated
You click to open   Some signal — you were curious
You read the author's profile  Some signal
You expand long content        A bit — you wanted to read more
You look at it 500ms+ without scrolling  Weak signal — passive attention
It just appeared on screen     Tiny signal
You scroll past quickly        Nothing learned (but noted)
You unlike something           Negative signal — you changed your mind
```

### Interest profiles get stale, so they refresh

Your taste changes. You go from being really into hiring advice to suddenly caring about growth hacking because you just launched your product. The profile is recomputed every hour for active users so it stays current.

It also uses **time decay** — things you engaged with 2 weeks ago count less than things you engaged with yesterday. It's not amnesia, it's more like recent experiences matter more in how you feel today.

---

## The Six Things Level 2 Actually Does

### Thing 1: Speed up the feed with Redis

**What's happening now:**
Every time you open the feed, the app goes to the database to check if your personalized feed is already computed and cached. That database lives on a server. Even a simple "yes, here's your cache" check takes 50-150 milliseconds.

**What Level 2 does:**
Adds Redis between the app and the database. Redis is a separate system that lives entirely in memory — it's essentially RAM. Checking RAM takes 5 milliseconds instead of 150.

**The mental model:**
Imagine you're looking for a book. Current system: you go to the library, ask the librarian, she finds it in the stacks, brings it back — 2 minutes. With Redis: the librarian keeps the 50 most-requested books on a cart right next to her desk — 10 seconds.

For 70-80% of feed loads (cache hits), this is all that happens. The request hits Redis, gets the answer, returns. Done. No pipeline, no AI, no database query. Just instant.

**Why it doesn't cost anything extra:**
The Redis service (Upstash) gives you 500,000 operations per month for free. At beta scale, you'll use about 150,000. You have 3x headroom before paying anything.

---

### Thing 2: Keep the scoring tables filled via background jobs

**What's happening now:**
The feed ranking formula uses 3 important scores for each post:
- How engaging is this post? (likes, replies, shares relative to its age)
- How fast is this post growing? (engagement in the last 2 hours)
- What's the quality of the content?

These scores live in a database table called `post_features`. **That table is currently empty.** Nothing fills it. So those 3 signals — which together account for 25% of the ranking formula — are always zero. Every post looks equally "engaging" to the algorithm.

**What Level 2 does:**
Sets up a background job that runs automatically every 15 minutes. It looks at all posts from the last 3 days and computes those scores, then saves them. The feed engine can now actually use real engagement data.

**The mental model:**
Imagine a restaurant that wants to rank its menu items by popularity, but the waiters never write down what people ordered. Level 2 is like hiring someone whose only job is to tally order counts every 15 minutes and update the board. Now the kitchen knows what's actually selling.

---

### Thing 3: Keep interest profiles fresh via background jobs

**What's happening now:**
Your interest profile (the "you like startups and AI" thing) lives in another table called `user_interest_profiles`. It gets computed when explicitly triggered — but nothing triggers it automatically. So if you joined last week and interacted with 50 posts, your profile has never been built. The feed doesn't know you at all.

**What Level 2 does:**
Another background job runs every hour. It finds every user who was active in the last 24 hours and rebuilds their interest profile from scratch using all their interactions. Now the feed "knows" you after your first session.

**The mental model:**
Think of it like a personal shopper who studies your purchase history. Right now they only update your profile when you specifically call them. Level 2 means they automatically review your history every morning and update their notes without you having to ask.

---

### Thing 4: Understand what posts are about when they're created

**What's happening now:**
For the feed to match posts to your interests, it needs to know what each post is about. That information lives in a table called `content_embeddings`. **That table is also currently empty.** So when the feed tries to check "does this post match your interest in AI?" it has nothing to compare against. Topic matching — which is 10% of the ranking score — always returns zero.

**What Level 2 does:**
Every time a post is created, the system immediately reads the content and figures out what topics it covers. A post that says "Just closed our seed round after 18 months of building" gets tagged as: `startups, funding, product`. That tag goes into the database instantly.

It uses a simple keyword matcher (no AI call, no cost) — it has a dictionary of 8 topic categories and the keywords that map to each:
- **startups** → startup, founder, launch, mvp, pitch...
- **AI** → artificial intelligence, machine learning, model, llm...
- **design** → ux, ui, figma, prototype, interface...
- and so on.

**The mental model:**
Imagine a librarian who, every time a new book arrives, reads the back cover and puts it in the right section. Right now books arrive and just get stacked randomly. Level 2 means every new book gets shelved in the right section immediately, so when someone asks "show me books about investing," the librarian actually knows where to look.

---

### Thing 5: Track relationships between users reliably

**What's happening now:**
The feed tracks which users you interact with most. If you reply to @alice's posts frequently, the algorithm knows you care about her content and boosts it for you. This lives in a table called `user_interaction_graph`.

Currently, when your interactions get sent to the server, the system tries to update this relationship graph but does so as a "fire and forget" — it sends the update and doesn't check if it worked. If it fails, the failure is silently ignored and your relationship scores never update.

**What Level 2 does:**
When your interactions are processed, the update to the relationship graph now retries automatically if it fails. Up to 3 attempts before giving up. This means the data actually sticks.

**The mental model:**
You're sending a text to update your contact's phone number. Right now the app sends it and immediately forgets it sent it. If the message failed to deliver, you never know. Level 2 is like turning on read receipts and automatic resend — if it didn't go through, it tries again.

---

### Thing 6: See exactly what's happening inside the feed

**What's happening now:**
If the feed is slow or not personalizing correctly, there's no way to tell which part of the pipeline is the problem. Is it slow because of the database? Because of the AI call? Because there's no data?

**What Level 2 does:**
Every feed request now writes a structured log showing exactly how long each stage took:

```
Feed load for user abc12345:
  Total time: 476ms

  Stage 1 - Find candidates:    298ms  (found 187 posts)
  Stage 2 - Load your profile:  5ms    (from cache)
  Stage 3 - Score each post:    162ms  (187 posts scored)
  Stage 4 - Math ranking:       2ms    (sorted)
  Stage 5 - AI re-ranking:      0ms    (skipped, no API key)
  Stage 6 - Diversity rules:    1ms    (applied)
```

You can immediately see: the 298ms on finding candidates is the bottleneck. That's where to optimize next.

**The mental model:**
A car's check engine light tells you "something's wrong" but not what. Level 2 is like adding a dashboard that shows RPM, temperature, fuel flow, and oil pressure in real time. You know exactly what's happening and where the problem is before it becomes critical.

---

## How a Feed Load Works, Step by Step

Here's the complete journey from "you open the app" to "you see posts", in plain English:

### Step 1: You open the Ments feed

Your phone sends a request to the server: "Give me the feed for this user."

---

### Step 2: Check Redis (the fast memory cache) — 5-20ms

The server asks Redis: "Do I have a pre-computed feed for this user?"

**If yes (70-80% of the time):** Redis immediately returns a list of post IDs in ranked order. Jump to Step 7.

**If no:** Continue to Step 3.

---

### Step 3: Check the database cache — 50-100ms

The server asks the main database: "Do I have a cached feed for this user that hasn't expired yet?"

**If yes:** Return the cached list. Also save it to Redis so next time we don't need to ask the database. Jump to Step 7.

**If no (fresh start or cache expired after 2 hours):** Run the full pipeline.

---

### Step 4: Find candidate posts — ~300ms

The feed engine asks: "Out of all posts in the system, which 200 should I even consider?"

It pulls posts from 3 buckets:
- **~100 posts** from people you follow
- **~50 posts** from friends-of-friends (people your connections interact with)
- **~50 posts** that are currently trending or highly engaged

Posts are excluded if: they're deleted, they're replies (not top-level), they're from yourself, you've already seen them, or they're more than 3 days old.

---

### Step 5: Load your interest profile — ~5ms (from Redis)

The engine retrieves your personal taste profile — your topic scores, creator affinities, content preferences. This is now in Redis so it's basically instant.

If your profile is more than 1 hour old, it triggers a rebuild in the background while using the old one for this request.

---

### Step 6: Score all 200 candidate posts — ~200ms

For each of the 200 posts, the engine calculates a score using a weighted formula:

```
Score =
  How engaging is this post?           × 15%
  Is it going viral right now?         × 10%
  Do you follow the author?            × 20%  ← biggest factor
  Is author a friend-of-friend?        × 5%
  How much have you interacted with author? × 15%
  Have you liked this creator before?  × 10%
  Does it match your interest topics?  × 10%
  How new is it?                       × 10%
  Do you prefer this post format?      × 3%
  Does it have images/video?           × 2%
```

Posts are then sorted by score, highest to lowest.

**Optional Groq AI step:** If the Groq API key is configured, the top 50 posts get sent to an AI for a second opinion on ordering. This adds ~1 second of latency. At Level 2, this is optional — the feed works fine without it.

---

### Step 7: Apply diversity rules — ~1ms

Before finalizing, a few hard rules get applied:
- No more than 2 posts from the same author in your top 20
- No more than 3 text posts in a row (must break it up with media or a poll)
- At least 3 of your top 10 posts must be less than 6 hours old
- Small/new accounts get a 1.2× score bump so they have a chance to be discovered

---

### Step 8: Save the result — ~10ms

The final ranked list of 200 post IDs (with their scores) gets saved:
- To Redis: expires in 2 hours
- To the database: backup, also expires in 2 hours

---

### Step 9: Inject brand-new posts — ~50ms

The 2-hour cache means very new posts might not be in your ranked list. So right before serving the feed, the engine checks: "Have any posts been created since I built this cache?"

If yes, it quickly scores them and inserts them at positions 1, 5, and 10 in your feed. So fresh content always has a chance to appear near the top.

---

### Step 10: Fetch full post content — ~100ms

So far we only have a list of post IDs and scores. Now the server fetches the actual content of those 20 posts (author name, photo, text, images, likes count, replies count, poll options, etc.).

---

### Step 11: Return to your phone

The 20 posts in ranked order arrive on your device. Total time: 8ms (cache hit) to 3 seconds (full pipeline with AI).

---

## What's Running in the Background (You Never See This)

While you're using the app, several things happen automatically on a schedule:

```
Every 15 minutes:
  → Recompute engagement scores for all posts from the last 3 days
    (so the ranking knows which posts are gaining traction)

Every 30 minutes:
  → Figure out what's trending right now
    (which topics have the most engagement in the last 24 hours)

Every 1 hour:
  → Rebuild interest profiles for everyone who was active in the last 24 hours
    (so the feed reflects your recent behavior, not just last week's)

Every day at 1 AM:
  → Summarize yesterday's analytics
    (total impressions, engagement rate, average time spent, unique users)

Every day at 3 AM:
  → Clean up old data
    (delete events older than 90 days, delete expired cache, prune old sessions)

Every time a post is created:
  → Read the post content and figure out what topics it covers
    (tag it so the ranking can match it to users who care about those topics)

Every time you like/reply/share something:
  → Update the relationship graph between you and that post's author
    (with retry if it fails)
```

---

## What Level 2 Fixes That's Currently Broken

| What's broken now | What Level 2 does | Effect |
|---|---|---|
| Feed cache is in the slow database | Add Redis in front | Feed loads 5-10× faster for returning users |
| `post_features` table is empty | pg_cron fills it every 15min | 25% of the ranking formula starts working |
| `user_interest_profiles` table is empty | pg_cron fills it hourly | Feed actually knows who you are |
| `content_embeddings` table is empty | Extract topics on post create | Topic matching starts working (10% of ranking) |
| Interaction graph updates sometimes get lost | Add retry logic | Creator affinity scores (15% of ranking) accumulate correctly |
| No way to see what's slow | Add per-stage timing logs | You can debug performance issues |
| `trending_topics` table empty | pg_cron fills it every 30min | Trending widget works |
| `feed_analytics_daily` always empty | pg_cron fills it nightly | Analytics dashboard works |
| New injected posts get wrong follow status | Fix the bug | New posts scored correctly |

---

## Why Not Just Keep It Simple (Chronological)?

This is a fair question. Chronological (newest posts first) is:
- Simple to build ✓
- Zero latency ✓
- No scoring needed ✓
- Always works ✓

But it has a fatal problem: **as the platform grows, you drown.**

If 500 people post every day and you follow 200 of them, chronological means your feed moves so fast you can't keep up. You miss things that matter. You see things that don't interest you just because they were posted 2 minutes ago.

Personalized ranking solves this by asking: "Of the 200 posts from today, which 20 are most likely to matter to this specific person?" That's the feed engine's entire job.

At Ments' current scale (small, early), chronological is survivable. But the moment the platform gets to a few thousand active users, you need a smarter system. Level 2 is that system, built and ready.

---

## Cost Summary (No Math, Just Numbers)

**Current (dev environment):** ~$32/month
- That's just the AWS server cost

**With Level 2 added:** Still ~$32/month
- Redis is free at beta scale
- Background jobs run on the same server (no new servers needed)
- Groq API is optional (~$13/month if enabled, but skip it for now)

**When you'll start paying more:**
- Redis stays free until ~3,000 daily active users
- After that: roughly $5-10/month for Redis
- Everything else scales with AWS as you grow

Level 2 is essentially free to run. You're paying for better performance and personalization at no added cost during beta.

---

## The Three Things That Will Feel Different After Level 2

**1. The feed loads noticeably faster for returning users.** The first load of the day might still take a few hundred milliseconds (building the pipeline). But every subsequent scroll and refresh will feel nearly instant — 5-20ms instead of 150ms.

**2. The feed actually starts feeling personal.** Right now, without interest profiles or content tags, the ranking is basically: "posts from people you follow, sorted by freshness." After Level 2, it knows you care more about product posts than crypto posts, that you really engage with @alice's content, and that you prefer posts with media. The ordering will reflect that.

**3. You can see what's working and what isn't.** The pipeline logs will show you in real time: is the feed serving from cache? Is Groq running? Which stage is slow? You'll know in seconds if something is broken rather than finding out from a user complaint.

---

## FAQ

### About the Keyword / Topic System

**Q: What are the exact 8 topics the system recognizes?**

The system knows about these categories:
- **Technology** — keywords like: software, developer, programming, code, app, saas, api...
- **AI** — keywords like: artificial intelligence, machine learning, llm, gpt, neural network, model...
- **Startups** — keywords like: startup, founder, launch, mvp, pitch, bootstrapped, equity...
- **Design** — keywords like: ux, ui, figma, prototype, interface, typography, wireframe...
- **Career** — keywords like: hiring, job, resume, interview, promotion, salary, recruiter...
- **Funding** — keywords like: fundraise, seed round, vc, investor, valuation, term sheet...
- **Product** — keywords like: product, roadmap, feature, user research, sprint, backlog...
- **Community** — keywords like: community, network, event, meetup, collaboration, partnership...

That's it. If a post doesn't contain words that map to one of these 8, it goes untagged.

---

**Q: What happens if a post doesn't match any of the 8 topics?**

It just gets no topic tag. The feed can still rank it — it'll still get scored on freshness, how many people engaged with it, whether you follow the author, and so on. It just won't get a boost (or penalty) from topic matching. Topic matching is only 10% of the ranking formula, so an untagged post isn't invisible — it's just missing one signal.

At beta scale, most posts from founders will naturally fall into at least one of the 8 topics. If you're finding many posts are untagged, that's a signal to add more keywords to the dictionary later.

---

**Q: What if a post is about multiple topics?**

It gets tagged with all of them. A post like "We just raised our seed round and shipped a new AI feature" would be tagged as: `funding`, `ai`, `product`. All three apply and all three contribute to matching it against users who care about any of those topics.

---

**Q: Can keyword matching get it wrong?**

Yes, sometimes. Keyword matching is fast and cheap but not smart. A few failure modes:

- "Apple just announced a new MacBook" → tagged as `technology`. Correct. But "I ate an apple" → probably doesn't match anything, which is fine because it's just a personal post.
- "We're building a model railroad" → could accidentally get tagged as `ai` because "model" is a keyword. It would score poorly anyway since the user interested in AI would quickly scroll past it.
- "I got rejected by 20 VCs before our seed closed" → tagged as `funding`. Correct.

The errors are rare and mostly harmless. The scoring for topic match is only 10% of the total. Getting one topic wrong by a small amount doesn't meaningfully change where a post lands in the ranking.

---

**Q: Does it understand context? Like "Apple" the company vs an apple the fruit?**

No. Simple keyword matching has no understanding of context. It just looks for the word or phrase. This is actually fine at Ments' scale — the content is almost entirely startup/founder content, so when "model" appears it almost always means an AI model, not a clay model. The audience self-selects context.

If this becomes a real problem at scale, Level 3+ would replace this with actual AI-powered topic detection. For now, it's good enough.

---

**Q: What if someone writes in French, Spanish, or another language?**

The keyword dictionary is English-only right now. A post in French would almost certainly match zero topics and go untagged. That affects the 10% of the ranking that's topic-based. Everything else (freshness, who posted it, how many likes it got, whether you follow the author) still works fine regardless of language.

---

**Q: What about slang, abbreviations, or startup jargon?**

The dictionary was built with startup jargon in mind, so things like "mvp," "mrr," "arr," "pov," and "gtm" are already included. Standard abbreviations for the 8 categories are in there. If a term is missing, it's a one-line edit to add it — the dictionary is just a list of strings, not a machine learning model.

---

**Q: What happens to posts that already exist before Level 2 is turned on?**

The new topic extraction only runs when a post is *created*. Old posts don't automatically get tagged. There's a separate one-time backfill job that can be run manually to process all existing posts — it does the same keyword check but on the historical archive. This is included in the Level 2 implementation as a pg_cron job that runs once.

---

**Q: Can new topics be added later?**

Yes, easily. The dictionary is a plain list you edit in one place in the code. Want to add a `health` category covering wellness, fitness, longevity, biohacking? Add 20 keywords and deploy. No model retraining, no AI updates. New posts will start getting tagged immediately; old posts need the backfill re-run.

---

**Q: Why only 8 topics? Why not 100?**

More categories sounds better but creates problems:
- **Overlap confusion**: Where does "SaaS pricing" go — product, funding, or startups?
- **Sparse matching**: With 100 categories, most posts would match only 1 or 0, making the signal weak
- **Maintenance burden**: Someone has to maintain 100 keyword lists and keep them accurate

8 broad categories means most posts on Ments will match at least one and probably two. The categories are wide enough to be useful, narrow enough to be distinct. This is the right call for now.

---

**Q: What's the difference between keyword tagging and "AI embeddings" I've heard mentioned?**

Keyword matching: fast (< 1ms), free, exact, dumb. Looks for specific words.

AI embeddings: slow (~200ms), costs money, fuzzy, smart. Understands meaning. "Securing venture capital" and "raising a seed round" would both be recognized as the same topic even with no shared keywords.

Level 2 uses keyword matching because it's free and fast enough. Level 4 would upgrade this to real AI embeddings for much more accurate topic detection. The `content_embeddings` table is already in the database for when that upgrade happens.

---

### About Interest Profiles

**Q: What if I'm brand new with zero interactions? Does the feed just not know me at all?**

For your first session, yes — the system has no signal about you. It falls back to showing you posts from people you follow, sorted by freshness and engagement. This is still a reasonable feed. After your first session of interacting (even just liking or spending time on posts), the hourly background job rebuilds your profile and the next session's feed starts personalizing.

Most platforms handle this the same way — Spotify's first week is generic. Ments' first session is generic. It gets better fast.

---

**Q: How many interactions do I need before my profile becomes useful?**

Rough estimates:
- **5-10 interactions**: The system has some signal but it's noisy
- **20-30 interactions**: Your top 2-3 interests are reasonably reliable
- **50+ interactions**: Profile is solid across multiple topics

A typical session where you scroll 25 posts and engage with 5-10 of them is enough to build a rough profile after 2-3 sessions.

---

**Q: What if I interact with content I don't actually care about?** (e.g., I liked something by accident, or I replied out of social obligation)

The profile is an approximation, not mind-reading. A single accidental like barely moves the needle — likes are weighted at 1.5 out of a max of 5.0. Replies are the strongest signal (weight 5.0), so if you reply frequently to posts you actually don't care about, the profile could drift.

In practice, this is rare and self-correcting. The profile uses time decay — interactions from 2+ weeks ago fade. If you stop engaging with content you don't care about, your profile corrects itself within a few days.

---

**Q: Does clicking "unlike" remove the signal from a like?**

Yes. Unliking has a negative weight of -1.0, so it partially cancels out the original like (which had a weight of +1.5). The net effect is -1.0 + 1.5 = +0.5 for a liked-then-unliked post. Not zero, but much weaker than a sustained like. This is intentional — the system notes that you changed your mind but doesn't pretend you never saw the post.

---

**Q: Does who I follow affect my interest profile?**

Following someone affects which posts appear as candidates (posts from people you follow get pulled into your candidate pool). But your interest profile is built from your interaction history, not your follow graph. So if you follow 50 people but only ever engage with 5 of them, your profile reflects those 5, not all 50.

---

**Q: Is my interest profile visible to anyone else?**

No. It lives in a database table that's only read by the feed engine. No other user can see it, no public API exposes it, and it's not shown in your profile page.

---

**Q: Can my interest profile get "stuck" on something I used to care about?**

The time decay is designed to prevent this. Interactions from 14 days ago have half the weight of interactions from today. After a month of not engaging with a topic, its score drops to near zero. Your profile naturally shifts as your behavior shifts.

However, if you had a very intense period of one topic (e.g., 3 weeks of replying to lots of funding posts during a fundraise) and then stopped entirely, it might take 1-2 weeks for the feed to fully adjust. This is a known limitation of time-decay profiles.

---

### About Background Jobs

**Q: What if the server restarts — do the scheduled jobs disappear?**

No. The jobs are stored in Postgres using the pg_cron extension, not in application memory. They're database records that survive restarts, deployments, and crashes. As long as the database is running, the jobs run on schedule.

---

**Q: What happens if a background job fails?**

pg_cron logs the failure and retries on the next scheduled run. If the post_features job fails at 3:00pm, it tries again at 3:15pm. The feed degrades slightly (scores are slightly stale) but doesn't break. It's resilient by design.

---

**Q: What if the 15-minute job takes longer than 15 minutes to run?**

At beta scale with a few hundred posts, these jobs finish in under a second. At 10,000 posts, still under 5 seconds. The job would have to be dealing with millions of posts before it risks overlapping with the next run. That's a Level 4/5 problem.

---

### About the Feed Cache

**Q: What happens when the 2-hour cache expires?**

The next time you open the feed after expiry, the full pipeline runs again (~300-700ms). You might notice a slightly slower load that one time. After that, the new cache is warm and loads are fast again for another 2 hours.

---

**Q: Does cache expiry mean you miss 2 hours of posts?**

No. The realtime injection step (Step 9 in the feed load) checks for any posts created after the cache was built and inserts them at positions 1, 5, and 10 in your feed. So even with a 2-hour-old cache, you always see the newest posts near the top.

---

**Q: If two users have identical interests and follow the same people, do they see the exact same feed?**

Almost, but not exactly. The scoring formula is deterministic — the same inputs produce the same outputs. So yes, if everything is identical, the ranked order would be identical. But in practice, no two users have the same interaction history, so their interest profiles differ, and their feeds differ.

---

### About the Scoring Formula

**Q: The formula weights "do you follow the author" at 20%. What about a really popular post from someone I don't follow?**

That post can still rank high through other signals:
- Engagement score (15%): if it has lots of likes and replies, it scores well here
- Velocity (10%): if it's gaining traction fast right now
- Topic match (10%): if it covers topics you care about
- Freshness (10%): if it's new

A genuinely great post from a stranger could combine 45% of the formula and still outrank a mediocre post from someone you follow. Following is the single biggest factor, but it's not everything.

---

**Q: What's the difference between "following" and "creator affinity"? They both seem like "I like this person."**

Following (20%) is a binary: you either follow them or you don't. It's set once.

Creator affinity (15%) is a continuous score that tracks how much you've *actually engaged* with their content. You could follow 500 people, but only have high affinity for 5 of them — the ones you consistently like, reply to, and share. Affinity is earned through behavior, not just a follow click.

The combination lets the system distinguish: "you follow @alice (binary yes) but you engage with her constantly (affinity 8/10)" vs. "you follow @bob (binary yes) but you always scroll past him (affinity 0.5/10)."

---

**Q: What's Level 3 going to fix that Level 2 doesn't?**

Level 2 makes the existing infrastructure work correctly. Level 3 would make it smarter:
- Replace keyword matching with real AI topic embeddings (so posts about "securing investment" match even without the word "fundraise")
- Add collaborative filtering ("users like you also engaged with...")
- Add session-aware personalization (adjust the feed based on what you've looked at in the current scroll session)
- Make the A/B experimentation system production-ready

Level 2 is about fixing what's broken. Level 3 is about adding intelligence on top of a working foundation.
