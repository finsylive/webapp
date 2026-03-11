# User Type UX Suggestion — Ments Platform

## Current State Audit

### What `user_type` Controls Today

The `users.user_type` column is a hard enum: `'mentor' | 'normal_user' | 'founder' | 'investor'`.

After searching the entire codebase, `user_type` is functionally used in **3 places**:

1. **Onboarding redirect** — determines landing page after selection
2. **Search page** — shows a "Mentor" badge for `user_type === 'mentor'`
3. **Resource recommendations API** — passes type as context to AI

That's it. The sidebar, nav, pages, and permissions are **identical** regardless of type. `founder_profiles` and `investor_profiles` tables exist but are never read by any frontend code. They're empty schema.

### Known Bugs

1. **Onboarding sends `'explorer'` but DB only allows `'normal_user'`** — the CHECK constraint will reject `explorer`. Latent failure.
2. **"Change this later in settings" is a lie** — onboarding page (line 246) promises this, but Settings has no role management UI.

---

## The Core Problem

The platform forces a hard identity choice during onboarding, but reality is fluid:

- A founder who angel invests cannot be both
- An explorer who starts building has no path to founder features
- An investor who launches a side project is locked out of founder tools
- The "mentor" type has zero features — dead weight
- "Explorer" isn't a type, it's the absence of one

---

## Proposed Model: Explorer-Default + Additive Capabilities

### The Principle

Everyone starts as an explorer. Explorer is the base layer, not a type. **Founder** and **Investor** are capabilities activated by action, not by onboarding declaration.

### Data Model Change

```sql
-- Add to users table
ALTER TABLE public.users
  ADD COLUMN primary_interest text DEFAULT 'exploring'
    CHECK (primary_interest IN ('exploring', 'building', 'investing')),
  ADD COLUMN investor_status text DEFAULT 'none'
    CHECK (investor_status IN ('none', 'applied', 'verified', 'rejected'));

-- Founder status derived from: does user own a startup_profile?
-- No column needed. The proof is the action.
```

### How Types Work Under This Model

| Capability | How You Get It | How It's Stored |
|---|---|---|
| Explorer | Default for everyone | Base state, no flag needed |
| Founder | Create a startup profile | `startup_profiles.owner_id = user.id` |
| Investor (unverified) | Express interest | `investor_status = 'applied'` |
| Investor (verified) | Admin approval | `investor_status = 'verified'` |

A user can be an explorer + founder + verified investor simultaneously. No mutex.

---

## Onboarding Redesign

### Current Flow

```
Google Sign-In → Create user (normal_user) → /onboarding
→ Pick Explorer/Investor/Founder → Set user_type → Redirect by type
```

### Proposed Flow

```
Google Sign-In → Create user → /onboarding
→ "What interests you most?" (multi-select) → Set primary_interest → Everyone → /
```

**Onboarding screen copy** (active voice, max 7 words):

```
What interests you most?

[  ] Building products and startups
[  ] Investing in early-stage companies
[  ] Discovering ideas and people
```

- Multi-select allowed (pick 1–2). First selected = `primary_interest`.
- These are interest signals, not identity assignments.
- Everyone lands on `/` (the feed). No type-based routing.

**Post-redirect contextual prompts** (in feed sidebar, not modals):

| Interest Selected | Sidebar Prompt |
|---|---|
| Building | "Launch your startup profile →" links to `/startups/create` |
| Investing | "Apply for investor access →" links to verification modal |
| Discovering | Suggested people to follow |

---

## Investor Verification Flow

### 4 Approaches Evaluated

#### A. Locked Dashboard with Preview — NOT RECOMMENDED

Show blurred investor dashboard with "Verify to unlock" overlay.

**Why not:** Dark pattern. Creates resentment. User feels tricked. Requires building an entire dashboard just to blur it. Violates the "no product tours" taste rule — previewing features you can't use IS a tour.

#### B. Common Features + Verification CTA — RECOMMENDED

After expressing investor interest, user gets the full common experience. Additionally:

1. **Slim banner on `/startups`:** "Want deal flow and financials? Verify as investor." Not a modal, not a popup. Just a bar.
2. **Click opens verification modal** (not a full page — the form is sparse):
   - Firm/fund name
   - Investor type (angel, VC, family office, accelerator, corporate VC)
   - LinkedIn URL
   - Brief investment thesis (1–2 sentences)
   - This populates `investor_profiles` and sets `investor_status = 'applied'`
3. **While pending:** Banner becomes "Verification in progress. We'll notify you." User keeps using all common features. No dead-end.
4. **On approval:** `investor_status = 'verified'`. Unlocks:
   - See `visibility: 'investors_only'` startups
   - See pitch decks, funding rounds, financials
   - "Verified Investor" badge on profile
   - "Raising Now" filter on `/startups`
5. **On rejection:** Banner: "Application not approved. Contact support." One sentence. Honest.

#### C. Progressive Disclosure (Tiered) — VIABLE BUT OVERKILL

Unlock investor features in tiers: Tier 0 (browse) → Tier 1 (email verified, see pitches) → Tier 2 (profile submitted, see funding) → Tier 3 (admin verified, see everything).

**Why not primary:** Per-field visibility checks on every startup page. Operational overhead exceeds trust benefit at current scale. Binary verified/unverified is sufficient.

#### D. Waitlist/Application — NOT RECOMMENDED (FOR NOW)

Application + waitlist, admitted in batches.

**Why not:** Makes sense at 10,000 investors. At current scale, it's theater. The manual admin review in Approach B achieves the same trust gate.

---

## Feature Overlap Matrix

| Feature | Explorer | Founder | Investor (Unverified) | Investor (Verified) |
|---|---|---|---|---|
| Feed, posts, trending | Yes | Yes | Yes | Yes |
| Create posts | Yes | Yes | Yes | Yes |
| Messages / DMs | Yes | Yes | Yes | Yes |
| Search (people, startups) | Yes | Yes | Yes | Yes |
| Hub (jobs, gigs, events, resources) | Yes | Yes | Yes | Yes |
| Profile (edit, experience, education) | Yes | Yes | Yes | Yes |
| Browse startup directory | Yes | Yes | Yes | Yes |
| Upvote/bookmark startups | Yes | Yes | Yes | Yes |
| View public startup profiles | Yes | Yes | Yes | Yes |
| **Create startup profile** | Anyone* | Yes | Anyone* | Anyone* |
| **Manage startup** (/startups tab) | — | Yes | — | — |
| **See "investors_only" startups** | No | No | No | **Yes** |
| **See pitch decks, financials** | No | No | No | **Yes** |
| **"Verified Investor" badge** | No | No | No | **Yes** |
| **Appear in investor directory** | No | No | No | **Yes** |

*Anyone can create a startup. The act of creating one IS becoming a founder.

**Key insight:** 85% of features are shared. Only 4–5 features are type-specific, and 3 of those are investor-gated. The base experience is universal.

---

## Role Switching / Adding

### The Old Way (broken)

"Go to settings, change your type." Doesn't exist. Even if built, forces a swap.

### The New Way

Role switching is eliminated as a concept. You don't switch. You activate.

| Want to become... | Action | What happens |
|---|---|---|
| Founder | Go to `/startups/create`, fill wizard | You now own a startup. You're a founder. |
| Investor | Click "Apply for investor access" on `/startups` | Modal → form → admin review → verified |
| Neither anymore | Delete startup / deactivate investor status in Settings | Capabilities removed. Posts and profile remain. |

**Settings addition** — under "Account":

```
Your Primary Interest
Choose what Ments prioritizes for you.

( ) Building products
( ) Investing in startups
( ) Exploring and learning
```

Radio group. Adjusts feed ranking, not access. Copy: "This affects your feed, not your access."

---

## Navigation Implications

### Current Sidebar (stays unchanged)

```
Home | Search | Messages | Startups | Hub | Profile
```

Six items. Universal. Do NOT add type-specific nav items.

### Contextual Changes Inside Pages

**On `/startups`:**
- Tab bar: "Directory" | "My Startup" (visible only if user owns a startup)
- If investor verified: additional filter "Raising Now" with financial details
- Merge current `/startups/my` into this page as a tab

**On profile pages:**
- If verified investor → show "Investor" section
- If founder → show their startup card

**Feed sidebar widgets (right column, desktop only):**

| Capability | Widget |
|---|---|
| Founder | "Your Startup" card — views, team, status |
| Verified Investor | "Recent Deal Flow" — 3–4 startups raising now |
| Everyone | Communities, Recent Activity, People to Connect |

### Mobile Nav (no change)

5 items: Home, Search, Startups, Hub, Profile. Already at the iOS HIG limit.

---

## The "Explorer" Problem

### Is Explorer a useful type?

**No.**

1. It unlocks nothing — same features as every other type
2. It's the default state (`auth/callback` creates users as `normal_user`)
3. It creates a false trichotomy — "Explorer" is just "I don't know yet"
4. LinkedIn doesn't ask "job seeker, recruiter, or browser?" — everyone gets the platform

### Correct Framing

Everyone is an explorer. Explorer is the base layer. Founder and investor are additive capabilities on top. Remove "Explorer" as a selectable identity.

---

## The "Mentor" Problem

The `mentors` table has **one field**: `average_rating`. Zero features, zero UI, zero usage. The `mentor` value exists in the `user_type` CHECK constraint but is not offered during onboarding.

**Recommendation:** Kill it. Remove from CHECK constraint. Drop the `mentors` table. If mentorship becomes a real feature later, design it properly then. Dead schema is confusing schema.

---

## Implementation Priority

### Phase 1 — Fix the Broken (now)

1. **Fix the `explorer` bug** — map `explorer` → `normal_user` in `/api/onboarding/route.ts`
2. **Add role change to Settings** — fulfill the "change this later" promise with a dropdown

### Phase 2 — Additive Roles Migration (1–2 weeks)

1. Add `primary_interest` and `investor_status` columns to `users`
2. Rewrite onboarding to interest-based multi-select
3. Build investor verification modal (sparse form, not full page)
4. Merge `/startups/my` into `/startups` as a tab
5. Add contextual sidebar widgets based on capabilities

### Phase 3 — Gated Investor Features (2–3 weeks)

1. Admin review pipeline for investor applications
2. `investor_status` checks on startup detail pages (hide financials from non-verified)
3. "Verified Investor" badge (reuse existing `VerifyBadge.tsx` pattern)
4. `visibility: 'investors_only'` filter on startup queries

### Phase 4 — Deprecate `user_type` (later)

1. Backfill `primary_interest` from existing `user_type` values
2. Remove `user_type` from onboarding and settings
3. DB migration to deprecate column
4. Drop `mentors` table

---

## Summary of Positions

| Question | Position |
|---|---|
| Hard enum or additive? | **Additive.** Hard enum doesn't reflect reality. |
| Should onboarding ask type? | **No.** Ask interest, not identity. |
| Is Explorer a useful type? | **No.** It's the base state, not a type. |
| Investor verification model? | **Common features + async verification CTA.** No locked dashboards. |
| Separate nav per type? | **No.** Universal nav, contextual sub-pages. |
| Full page for investor app? | **No.** Modal. The form is sparse. |
| Settings role toggle? | **Yes, for `primary_interest` only.** Capabilities activated by action. |
| What about mentor type? | **Kill it.** Zero features, zero usage. |

---

## FAQ — Brainstorm & Discussion

### Q: Where do the dashboards actually live?

The platform has 6 universal nav items: **Home, Search, Messages, Notifications, Hub, Profile**. That stays. The question is where capability-specific dashboards go.

**Current reality check:** Right now, none of these dashboards exist in code:
- No investor dashboard (no deal flow, no portfolio tracking, no financials view)
- No founder recruitment dashboard (applications table exists, but zero management UI)
- No founder funding pipeline (funding_rounds data exists, but no lead tracking)
- Job posting has API endpoints but no creation UI

So we're designing from scratch. The answer:

**The `/startups` nav item becomes the umbrella for all startup-related workflows.** It's not just a directory — it's the startup workspace. Tabs appear based on what you've activated:

```
/startups
├── Directory          (everyone — the current Product Hunt-style leaderboard)
├── My Startup         (visible if you own a startup_profile)
│   ├── Overview       (stats, publish toggle — current /startups/my)
│   ├── Funding        (pipeline: who's interested, round status, investor comms)
│   └── Recruitment    (jobs/gigs you've posted, applications, AI scores)
└── Deal Flow          (visible if investor_status = 'verified')
    ├── Pipeline       (startups you're tracking, stages: watching → interested → in talks → invested)
    └── Portfolio      (your investments, updates from founders, financials)
```

**Why under /startups and not a separate "Dashboard" nav item?**
- Adding a 7th nav item for "Dashboard" breaks mobile (5-item limit)
- The content is inherently startup-related — it belongs here
- Contextual tabs are discoverable but not cluttering for users who don't need them

**Hiring lives under Hub, not Startups.** Posting jobs/gigs is already a Hub feature. You don't need to be a founder to hire — any user or startup can post. The recruitment management (viewing applications) lives at Hub → My Listings.

```
/hub
├── Events             (everyone — events, competitions, meetups, workshops)
├── Jobs               (everyone — browse jobs/gigs)
├── Resources          (everyone — tools, schemes, offers)
└── My Listings        (visible if you've posted jobs/gigs/events)
    ├── Jobs posted, applications received, AI match scores
    └── Events created, participation tracking
```

---

### Q: I'm an explorer who wants to hire AND invest. Walk me through it.

**Day 1: Sign up, onboarding.**
- You pick interests: "Investing" + something else (multi-select)
- You land on the feed. Sidebar prompt: "Apply for investor access →"

**Day 2: You want to post a job.**
- Go to Hub → Jobs → "Post a Job" button
- Fill the form (company, title, description, requirements)
- No founder status needed. Anyone can post a job.
- Your listing appears. Applications come in.
- Hub → My Listings → see applications with AI match scores

**Day 3: You want to invest.**
- Go to Startups → browse the directory
- Slim banner: "Want deal flow and financials? Verify as investor."
- Click → modal form (firm name, type, LinkedIn, thesis) → submit
- `investor_status = 'applied'`. Banner: "Verification in progress."
- You keep browsing, upvoting, bookmarking startups normally.

**Day 5: Investor verified.**
- Notification: "You're verified as an investor."
- Startups page now has a "Deal Flow" tab
- You can see `investors_only` startups, pitch decks, financial details
- You track startups through your pipeline: watching → interested → in talks → invested
- "Verified Investor" badge on your profile

**At no point did you need to "become" anything.** You just did things. The platform adapted.

---

### Q: Would a founder see the Deal Flow tab? Would an investor see My Startup?

**You only see tabs for capabilities you've activated.**

| You are... | Directory | My Startup | Deal Flow |
|---|---|---|---|
| Explorer | Yes | — | — |
| Founder only | Yes | Yes | — |
| Investor only (verified) | Yes | — | Yes |
| Founder + Investor | Yes | Yes | Yes |

If you're a founder AND a verified investor, you see 3 tabs. That's it. Not 3 dashboards, not 3 nav items. 3 tabs on one page. Each tab is a distinct workflow:

- **My Startup** = I'm building, managing my fundraise, tracking who's interested in MY startup
- **Deal Flow** = I'm investing, evaluating OTHER startups, managing my portfolio

These are genuinely different activities. A founder reviewing their own funding pipeline is the mirror image of an investor reviewing their deal flow — same data, opposite perspective. They don't conflict.

---

### Q: Are the overlaps even a problem?

**No.** Here's why:

**1. The workflows are distinct.** Managing your startup is not the same task as evaluating startups to invest in. You're in a different mental mode. The tabs make this explicit — you actively switch context by clicking a different tab.

**2. The overlap population is small.** Most users will be explorers (no extra tabs). Some will be founders. Fewer will be verified investors. The number who are both founder AND investor is the smallest group. Designing panic for a power-user edge case that most users never hit is wasted energy.

**3. Real products handle this fine.** AngelList lets you be a founder AND an investor. They don't create separate apps — they have contextual views. LinkedIn lets you be a job seeker AND a recruiter. GitHub lets you be a contributor AND an org admin. The pattern is universal: same nav, contextual surfaces.

**4. Three tabs is not clutter.** The danger would be 7+ tabs or a sidebar that morphs into an enterprise control panel. Three tabs on a page is normal. Users understand tabs.

**Where overlaps WOULD be a problem:**
- If the nav itself changed per type (confusing — "where did that menu item go?")
- If dashboards had conflicting data (e.g., the same startup appearing in both My Startup and Deal Flow with different states)
- If switching between founder/investor modes required a settings toggle or mode switch

The additive tab model avoids all three. The nav is stable. The data is scoped. The context is explicit.

---

### Q: What about the founder funding pipeline vs. investor deal flow — aren't those the same data?

Yes and no. They're the same underlying relationship (investor ↔ startup) but seen from opposite sides:

**Founder sees (My Startup → Funding tab):**
```
Investor Pipeline
─────────────────────────────────
Acme Capital        Interested    3 days ago    "Loved the traction metrics"
Seed Fund           Watching      1 week ago     —
Jane Angel          In Talks      Yesterday     "Scheduling call for Tuesday"

Your Round: Pre-Seed · Target: ₹50L · Raised: ₹20L
```

**Investor sees (Deal Flow → Pipeline tab):**
```
My Pipeline
─────────────────────────────────
Startup Alpha       In Talks      Yesterday     Pre-Seed · ₹50L target
Startup Beta        Watching      3 days ago    MVP · SaaS · 2x MoM growth
Startup Gamma       Invested      2 weeks ago   Seed · ₹1Cr closed

Portfolio Value: 3 startups · ₹75L deployed
```

Same relationship table in the DB. Different queries. Different UI. No conflict.

---

### Q: No FOMO is needed for subscription — so how do we frame gated features?

Right. No dark patterns, no "upgrade to unlock", no blurred previews. The framing is:

**For investor verification:**
- Not a paywall. It's a trust gate. The copy is honest: "Investor verification protects founder data. Apply to access financials and pitch decks."
- The benefit is real: you see things non-investors can't. Not because we're hiding it to upsell — because founders chose to share it only with verified investors (`visibility: 'investors_only'`).

**For features that don't exist yet (deal flow, pipeline, recruitment):**
- Don't show empty states for features you haven't built. If Deal Flow doesn't exist yet, don't show a Deal Flow tab with "Coming Soon."
- Build the feature → ship it → the tab appears. Clean.

**If subscriptions come later:**
- Gate on volume, not access. Example: free = track 5 startups in pipeline, paid = unlimited. Not: free = can't see pipeline at all.
- Show the user what they have, not what they're missing. "You're tracking 4 of 5 startups" not "Upgrade to track more!"

---

### Q: What does the nav look like on mobile for a power user (founder + investor)?

Same 5 bottom tabs as everyone: **Home, Search, Startups, Hub, Profile.**

When they tap "Startups", they land on the page with 3 tabs at the top: Directory | My Startup | Deal Flow. The capability tabs are on the page, not in the nav bar. The nav bar never changes.

This means a founder+investor is 2 taps from any dashboard:
1. Tap "Startups" (bottom nav)
2. Tap "Deal Flow" or "My Startup" (page tabs)

Under the 3-step rule. Clean.

---

### Q: What about the recruitment dashboard — does that need founder status?

**No.** Recruitment (posting jobs, reviewing applications) is a Hub feature, not a Startups feature.

- Anyone can post a job. The `jobs.created_by` field is just `auth.users(id)`.
- A startup can also own jobs via `jobs.startup_id`, but it's optional.
- An explorer who wants to hire goes to Hub → Jobs → "Post a Job."
- Their posted listings and incoming applications show up under Hub → My Listings.

This means hiring is fully decoupled from founder status. You don't need a startup profile to recruit. This is correct — a consulting firm, a freelancer looking for a subcontractor, or an established company can all post jobs without being "founders."

**Founder-specific recruitment** is when jobs are posted THROUGH the startup profile (linked via `startup_id`). In that case, the job shows the startup brand, logo, and links back to the startup page. But the management of applications still lives under Hub → My Listings.

---

### Q: What's the priority order for building these dashboards?

Based on what already exists in the DB vs. what has UI:

| Dashboard | DB Schema | API | Frontend UI | Priority |
|---|---|---|---|---|
| Job posting form | `jobs` table exists | Partial | **None** | **High** — data exists, no way to create from UI |
| Application management | `applications` table exists | Yes (AI scoring works) | **None** | **High** — applications happen but no one can review them |
| Founder overview | `startup_profiles` exists | Yes | **Minimal** (current /startups/my) | Medium — works but thin |
| Founder funding pipeline | `startup_funding_rounds` exists | Partial | **None** | Medium — data partially exists |
| Investor verification | `investor_profiles` schema exists | **None** | **None** | Medium — prerequisite for deal flow |
| Investor deal flow | **No schema** | **None** | **None** | Low — needs new tables + full build |
| Investor portfolio tracking | **No schema** | **None** | **None** | Low — needs deal flow first |

**Build order:**
1. Job posting UI + application management (Hub → My Listings) — highest ROI, the data pipeline already works
2. Investor verification modal + admin review
3. Founder funding pipeline (My Startup → Funding tab)
4. Investor deal flow (new schema + Deal Flow tab)
5. Portfolio tracking (extension of deal flow)

---

## Schema Changes — Current vs. Required

### What Already Exists and Maps Cleanly

| Proposed Feature | Existing Table | Status |
|---|---|---|
| Startup directory | `startup_profiles` | Works as-is |
| Startup leaderboard / upvotes | `startup_profiles` + `project_upvotes`* | Works (uses startup_bookmarks for votes) |
| Founder team management | `startup_founders` | Works — has roles, permissions, invite status |
| Founder funding history | `startup_funding_rounds` | Works — investor name, amount, round_type, date |
| Founder incubator/awards | `startup_incubators`, `startup_awards` | Works |
| Startup profile views | `startup_profile_views` | Works |
| Startup bookmarks | `startup_bookmarks` | Works |
| Job listings | `jobs` | Works — full schema with categories, skills, experience levels |
| Gig listings | `gigs` | Works — similar to jobs but for freelance |
| Applications + AI scoring | `applications` | Works — match_score, AI questions, interview_score, hire_suggestion all exist |
| Investor profile data | `investor_profiles` | Works — firm_name, type, check_size, sectors, thesis, LinkedIn |
| Founder profile data | `founder_profiles` | Exists but **redundant** — `startup_profiles` already covers company info. See note below. |
| Events / competitions | `events`, `competitions`, related tables | Works |
| Notifications | `inapp_notification` | Works |
| Conversations / DMs | `conversations`, `messages` | Works |

**Note on `founder_profiles` vs `startup_profiles`:** After field-by-field audit, `founder_profiles` is **80% redundant**. 8 of 11 fields duplicate `startup_profiles` or `users`. The only unique field is `looking_for` (array: cofounder, funding, mentorship, etc.). `raise_amount` and `is_actively_raising` belong on the startup (the company raises, not the person). `linkedin` belongs on `users`. **Recommendation:** Deprecate `founder_profiles`. Move `looking_for` to `users` table as a general-purpose field (any user can be looking for things). Move `raise_amount` to `startup_profiles`. Add `linkedin` to `users`. See detailed breakdown in FAQ below.

---

### Changes to `users` Table

```sql
-- ADD: Soft interest signal (replaces user_type for feed ranking)
ALTER TABLE public.users
  ADD COLUMN primary_interest text DEFAULT 'exploring'
    CHECK (primary_interest IN ('exploring', 'building', 'investing'));

-- ADD: Investor verification status
ALTER TABLE public.users
  ADD COLUMN investor_status text DEFAULT 'none'
    CHECK (investor_status IN ('none', 'applied', 'verified', 'rejected'));

-- ADD: When investor verification was decided
ALTER TABLE public.users
  ADD COLUMN investor_verified_at timestamp with time zone;

-- ADD: Salvaged from founder_profiles — useful for any user (cofounder, job, mentorship, etc.)
ALTER TABLE public.users
  ADD COLUMN looking_for text[] DEFAULT '{}';

-- ADD: Missing from users — currently misplaced on founder_profiles / investor_profiles
ALTER TABLE public.users
  ADD COLUMN linkedin text;

-- LATER (Phase 4): Deprecate user_type
-- Don't drop immediately — backfill primary_interest from user_type first
-- Mapping: 'normal_user'/'mentor' → 'exploring', 'founder' → 'building', 'investor' → 'investing'
```

**What stays unchanged on `users`:** Everything else. `is_verified`, `is_onboarding_done`, `onboarding_step`, `role` (admin system), `skills`, `profession` — all still needed.

**What moves to `startup_profiles`:**
```sql
-- ADD: How much the company is trying to raise (currently on founder_profiles, belongs on company)
ALTER TABLE public.startup_profiles
  ADD COLUMN raise_target text;
-- is_actively_raising already exists on startup_profiles ✓
```

---

### Changes to `investor_profiles` Table

The existing table is mostly correct but needs updates for Indian investor ecosystem and scouts.

**Current → Proposed:**

```sql
-- MODIFY: Add scout, syndicate_lead to investor_type
ALTER TABLE public.investor_profiles
  DROP CONSTRAINT investor_profiles_investor_type_check,
  ADD CONSTRAINT investor_profiles_investor_type_check
    CHECK (investor_type IN (
      'angel',           -- individual angel investor
      'vc',              -- VC fund partner/associate
      'scout',           -- VC scout (finds deals, doesn't invest personal capital)
      'syndicate_lead',  -- pools angel money via syndicates (e.g., LetsVenture, AngelList)
      'family_office',   -- family office
      'accelerator',     -- accelerator/incubator (e.g., Y Combinator, Techstars, etc.)
      'corporate_vc',    -- corporate VC arm (e.g., Reliance Jio, Tata, etc.)
      'government'       -- govt fund (e.g., SIDBI Fund of Funds, Startup India)
    ));

-- ADD: Which fund/firm does a scout represent?
ALTER TABLE public.investor_profiles
  ADD COLUMN affiliated_fund text;  -- "Sequoia India", "Peak XV" — for scouts/associates

-- MOVE linkedin to users table (was duplicated here and on founder_profiles)
-- linkedin stays here temporarily for backward compat, but canonical source becomes users.linkedin
```

**What each investor type means for the platform:**

| Type | Invests own money? | Needs deal flow? | Profile shows |
|---|---|---|---|
| `angel` | Yes | Yes | "Angel Investor · ₹5-25L checks" |
| `vc` | Fund's money | Yes | "Partner at Peak XV" |
| `scout` | No — refers deals | Yes (read-only pipeline) | "Scout for Sequoia India" |
| `syndicate_lead` | Pools others' money | Yes | "Syndicate Lead · 50+ co-investors" |
| `family_office` | Family capital | Yes | "Family Office · Multi-sector" |
| `accelerator` | Program equity | Yes | "Techstars Mumbai '24" |
| `corporate_vc` | Corporate treasury | Yes | "Jio GenNext" |
| `government` | Public funds | Yes | "SIDBI Fund of Funds" |

**Scouts specifically:** A scout gets the same deal flow access as a VC (they need to evaluate startups). The difference is:
- A scout cannot move a deal to `invested` stage — they can move to `interested` and `in_talks`, then hand off to their fund.
- Their profile shows "Scout for [Fund Name]" via `affiliated_fund`.
- The founder's pipeline shows "Scout at Peak XV" so the founder knows who they're actually dealing with.

**Verification form fields (the modal):**

```
Required:
  - Investor type          (dropdown: angel, vc, scout, syndicate_lead, etc.)
  - Firm/fund name         (text — or "Independent" for angels)
  - LinkedIn URL           (text — primary verification signal)
  - Investment thesis      (textarea, 2-3 sentences)

Conditional (shown based on type):
  - Affiliated fund        (shown if type = scout)
  - Check size range       (shown if type = angel, vc, family_office, syndicate_lead)
  - Preferred stages       (multi-select: pre_seed, seed, series_a, etc.)
  - Preferred sectors      (multi-select: SaaS, fintech, healthtech, etc.)

Optional:
  - Website
  - Portfolio count
```

---

### NEW TABLE: `investor_deals` (Deal Flow Pipeline)

This is the **only major new table** needed. It tracks the investor↔startup relationship from the investor's perspective.

```sql
CREATE TABLE public.investor_deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL,                -- the investor (references users.id)
  startup_id uuid NOT NULL,                 -- the startup being tracked
  stage text NOT NULL DEFAULT 'watching'
    CHECK (stage IN ('watching', 'interested', 'in_talks', 'due_diligence', 'invested', 'passed')),
  notes text,                               -- private investor notes
  invested_amount text,                     -- filled when stage = 'invested'
  invested_date date,                       -- filled when stage = 'invested'
  instrument text                           -- SAFE, equity, convertible note, etc.
    CHECK (instrument IS NULL OR instrument IN ('safe', 'equity', 'convertible_note', 'other')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT investor_deals_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deals_unique UNIQUE (investor_id, startup_id),
  CONSTRAINT investor_deals_investor_fkey FOREIGN KEY (investor_id) REFERENCES public.users(id),
  CONSTRAINT investor_deals_startup_fkey FOREIGN KEY (startup_id) REFERENCES public.startup_profiles(id)
);
```

**What this table powers:**

| View | Query |
|---|---|
| Investor's Pipeline (Deal Flow tab) | `WHERE investor_id = ? AND stage != 'passed' ORDER BY updated_at` |
| Investor's Portfolio | `WHERE investor_id = ? AND stage = 'invested'` |
| Founder's Funding Pipeline | `WHERE startup_id = ? ORDER BY updated_at` |
| "Investors interested in you" count | `WHERE startup_id = ? AND stage IN ('interested', 'in_talks', 'due_diligence')` |

**This is the mirror table.** The founder sees it as "who's looking at my startup." The investor sees it as "my deal pipeline." Same rows, different filters.

---

### NEW TABLE: `investor_deal_activity` (Activity Log)

Optional but valuable — tracks stage transitions and communications within a deal.

```sql
CREATE TABLE public.investor_deal_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  actor_id uuid NOT NULL,                   -- who did this (investor or founder)
  activity_type text NOT NULL
    CHECK (activity_type IN ('stage_change', 'note_added', 'meeting_scheduled', 'document_shared', 'message')),
  from_stage text,                          -- for stage_change events
  to_stage text,                            -- for stage_change events
  content text,                             -- note text, meeting details, etc.
  metadata jsonb DEFAULT '{}'::jsonb,       -- flexible: meeting link, document URL, etc.
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT investor_deal_activity_pkey PRIMARY KEY (id),
  CONSTRAINT investor_deal_activity_deal_fkey FOREIGN KEY (deal_id) REFERENCES public.investor_deals(id),
  CONSTRAINT investor_deal_activity_actor_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id)
);
```

**What this powers:**
- Activity timeline on both founder and investor dashboards
- "Jane Angel moved to In Talks · 3 days ago"
- "You shared your pitch deck · Yesterday"

---

### Tables That Need NO Changes

| Table | Why it's fine |
|---|---|
| `jobs` | `created_by` already supports any user posting. `startup_id` is optional for startup-linked jobs. |
| `gigs` | Same as jobs. |
| `applications` | Full AI scoring pipeline exists. Just needs a frontend. |
| `startup_profiles` | Complete schema for founder workspace. |
| `startup_funding_rounds` | Founder-entered historical data. Separate from `investor_deals` (which tracks live pipeline). |
| `startup_founders` | Team management with roles/permissions already works. |
| `startup_bookmarks` | Basic save/unsave for any user. Coexists with `investor_deals` (bookmarks are casual, deals are serious). |
| `conversations` / `messages` | DMs already work. Deal-related conversations can be linked via `investor_deal_activity.metadata`. |
| `inapp_notification` | Flexible `type` + `extra` jsonb handles new notification types (investor_verified, deal_stage_changed, etc.). |

---

### Tables to Deprecate (Phase 4)

| Table | Why | Migration |
|---|---|---|
| `founder_profiles` | 80% redundant with `startup_profiles` + `users`. Only unique field is `looking_for`. | Move `looking_for` → `users`. Move `raise_amount` → `startup_profiles`. Add `linkedin` → `users`. |
| `mentors` | One column (`average_rating`). Zero features, zero UI. | Drop. |
| `mentor_categories` | Junction table for dead `mentors` table. | Drop. |
| `reviews` | References `mentors`. Dead. | Drop. |

---

### Summary: Total Schema Impact

```
MODIFY existing:
  users                    +5 columns (primary_interest, investor_status, investor_verified_at, looking_for, linkedin)
  startup_profiles         +1 column (raise_target)
  investor_profiles        +1 column (affiliated_fund), expand investor_type CHECK, add 'referred' to deal stages

CREATE new:
  investor_deals           ~10 columns (the deal pipeline)
  investor_deal_activity   ~8 columns (activity log, optional)

NO changes:
  startup_profiles         ✓ already correct for founder workspace (plus raise_target added above)
  startup_funding_rounds   ✓ already correct for historical funding
  jobs / gigs              ✓ already correct for hub recruitment
  applications             ✓ already correct (just needs UI)
  startup_bookmarks        ✓ coexists with investor_deals
  startup_founders         ✓ team management works
  conversations/messages   ✓ DMs work
  inapp_notification       ✓ flexible enough for new types

DEPRECATE later:
  founder_profiles         80% redundant — salvage looking_for → users, raise_amount → startup_profiles
  mentors                  dead
  mentor_categories        dead
  reviews                  dead
```

**The delta is small.** 5 columns on `users` + 1 column on `startup_profiles` + 2 columns on `investor_profiles` + 1 essential new table + 1 optional new table. Everything else already exists.

---

## FAQ — Profiles, Funding & Investor Types

### Q: Why would a founder raise? Isn't it the company that raises?

**You're right. The company raises, not the person.** This is a data modeling error in `founder_profiles`.

`founder_profiles.is_actively_raising` and `founder_profiles.raise_amount` are about the company's fundraise — they belong on `startup_profiles`. And `startup_profiles` already has `is_actively_raising` and `total_raised`. The only missing piece is `raise_target` (how much you're trying to raise this round), which should be added to `startup_profiles`.

The founder as a person doesn't raise money. The founder manages a startup that raises money. The action happens through the startup profile, not the person's profile.

---

### Q: How does a founder's profile differ from a normal profile?

**Same base layout. Additive sections based on what you've done.**

Every user profile has the same structure:

```
┌─────────────────────────────────────────────┐
│  Banner + Avatar + Name + Tagline           │
│  City · Profession · "Verified Investor" badge (if applicable)
│  [Follow]  [Message]  [⋯ more]              │
├─────────────────────────────────────────────┤
│  About                                      │
│  Skills                                     │
│  Looking For (if set)                       │  ← from users.looking_for
├─────────────────────────────────────────────┤
│  ADDITIVE SECTIONS (only shown if data exists):
│                                             │
│  🏢 Startup Card (if owns a startup_profile)│
│     → brand name, stage, tagline, "Raising" │
│     → click to view full startup page       │
│                                             │
│  💼 Investor Info (if investor_status = verified)
│     → firm name, type, thesis, check size   │
│     → "Verified Investor" badge             │
│                                             │
│  📂 Work Experience                         │
│  🎓 Education                               │
│  📜 Licenses & Certificates                 │
│  🔗 Portfolio Links                         │
└─────────────────────────────────────────────┘
```

**The key principle: sections appear when data exists, not based on user_type.**

- If you've created a startup → your startup card shows on your profile
- If you're a verified investor → your investor info shows
- If you're both → both show
- If you're neither → just the base profile (about, skills, experience, education)

No special "founder profile page" or "investor profile page." One profile, additive sections.

The **"Looking For"** field (salvaged from `founder_profiles`) goes on the base profile for ANY user. Examples:

| User | Looking For |
|---|---|
| Explorer | "Internship, Mentorship" |
| Founder (idea stage) | "Technical Cofounder, Seed Funding" |
| Founder (scaling) | "Senior Engineers, Series A" |
| Investor | "Deal Flow in SaaS, Fintech founders" |
| Student | "Projects, Study Groups" |

This is a general-purpose intent signal, not founder-specific.

---

### Q: How does a founder post a request for funding?

**They don't "post" it. They toggle it on their startup.**

The startup is what raises, so the flow happens on the startup edit page:

1. Go to Startups → My Startup → Edit
2. In the "Funding" section:
   - Toggle `is_actively_raising` → ON
   - Set `raise_target` → "₹50L"
   - Set current round type → "Pre-Seed"
   - Optionally: upload pitch deck, fill traction metrics, set `visibility: 'investors_only'` for sensitive data
3. Save.

**What happens when raising is ON:**
- "Raising" badge appears on the startup card in the directory
- Verified investors see the financial details (raise target, revenue, traction)
- The startup shows up in the "Raising Now" filter on the directory
- Investors can add the startup to their deal pipeline (`investor_deals`)

**What does NOT happen:**
- No "funding request post" on the feed. The startup's presence in the directory IS the signal.
- No broadcast notification to all investors. That's spam.
- No separate "fundraising page." The startup profile IS the pitch — elevator pitch, problem statement, solution, traction, team, pitch deck. All already fields on `startup_profiles`.

**For pre-startup founders (idea stage, no startup_profile yet):**
- They set `users.looking_for = ['Cofounder', 'Pre-seed Funding']` on their personal profile
- This shows on their profile and makes them discoverable in search
- When they're ready, they create a startup profile and toggle raising ON

---

### Q: What's actually redundant in the founder profile database?

**Field-by-field audit of `founder_profiles`:**

| Field | Exists elsewhere? | Action |
|---|---|---|
| `company_name` | `startup_profiles.brand_name` | DROP — redundant |
| `industry` | `startup_profiles.categories` | DROP — redundant |
| `stage` | `startup_profiles.stage` (different enums!) | DROP — redundant AND inconsistent |
| `team_size` | `startup_profiles.team_size` | DROP — redundant |
| `pitch` | `startup_profiles.elevator_pitch` | DROP — redundant |
| `website` | `startup_profiles.website` | DROP — redundant |
| `location` | `users.current_city` + `startup_profiles.city` | DROP — redundant |
| `is_actively_raising` | `startup_profiles.is_actively_raising` | DROP — redundant |
| `raise_amount` | MISSING on startup_profiles | MOVE → `startup_profiles.raise_target` |
| `linkedin` | MISSING on users | MOVE → `users.linkedin` |
| **`looking_for`** | MISSING everywhere | MOVE → `users.looking_for` (general purpose) |

**Bonus inconsistency:** `founder_profiles.stage` uses `idea/pre_seed/seed/series_a/series_b_plus/profitable` but `startup_profiles.stage` uses `ideation/mvp/scaling/expansion/maturity`. These are describing different things — founder_profiles tracks funding stage, startup_profiles tracks product stage. Both are valid axes but only product stage belongs on the company. Funding stage is derived from `startup_funding_rounds` data.

**Conclusion:** Deprecate the entire `founder_profiles` table. Salvage 3 fields to their correct homes.

---

### Q: How does an investor's profile look? (especially Indian context)

**Same additive model as founders.** The base profile is identical. An investor section appears if `investor_status = 'verified'`:

```
┌─────────────────────────────────────────────┐
│  Ravi Mehta                                 │
│  Mumbai · Venture Capital                    │
│  ✓ Verified Investor                        │
├─────────────────────────────────────────────┤
│  About                                      │
│  "15 years in B2B SaaS. Previously CTO at..."│
├─────────────────────────────────────────────┤
│  INVESTOR INFO                              │
│  Partner at Peak XV Partners                │
│  Type: VC · Check size: ₹1-5 Cr            │
│  Stages: Seed, Series A                     │
│  Sectors: SaaS, Fintech, Developer Tools    │
│  Thesis: "Backing technical founders..."    │
│  Portfolio: 12 companies                    │
│  Status: Actively investing                 │
├─────────────────────────────────────────────┤
│  Looking For                                │
│  "B2B SaaS founders, AI-native products"    │
├─────────────────────────────────────────────┤
│  Work Experience · Education · etc.         │
└─────────────────────────────────────────────┘
```

**For a scout:**

```
│  INVESTOR INFO                              │
│  Scout for Sequoia India                    │  ← affiliated_fund shown
│  Type: Scout                                │
│  Stages: Pre-seed, Seed                     │
│  Sectors: Consumer, D2C, Health             │
│  Thesis: "Looking for 0→1 consumer plays"   │
│  Status: Actively scouting                  │  ← different verb
```

**Visibility rules:**
- Investor info section is visible to everyone (it builds trust and discoverability)
- Contact info (LinkedIn, email) visible to everyone (investors WANT to be reachable)
- The "Verified Investor" badge is the trust signal — founders know this person has been vetted

---

### Q: What about VC scouts and accelerator people — they don't invest themselves?

**Scouts are investors with a different capability scope.**

A scout's job is to find deals and refer them to their fund. They need:
- Browse the startup directory ✓ (everyone can)
- See financial details and pitch decks ✓ (need investor verification)
- Add startups to a pipeline ✓ (deal flow)
- Move deals to "interested" and "in_talks" ✓

They do NOT need:
- Move deals to "invested" (they don't write checks)
- Track portfolio value (no personal investments)

**How to handle in the system:**

1. **Verification:** Same flow. Scout applies with `investor_type = 'scout'` and fills `affiliated_fund = 'Peak XV'`. Admin verifies they actually scout for that fund (LinkedIn check).

2. **Pipeline difference:** A scout's pipeline stages are limited:
   - `watching` → `interested` → `referred` → `passed`
   - No `invested` stage. Instead, `referred` = "I've introduced this to my fund."
   - The fund partner (separate verified investor) picks it up from there.

3. **Profile display:** "Scout for [Fund Name]" — transparent about their role. Founders appreciate knowing whether they're talking to a decision-maker or a referral channel.

4. **Accelerator staff** are similar — they evaluate startups for their program, not for personal investment. `investor_type = 'accelerator'` with `affiliated_fund = 'Techstars Mumbai'`. They can track startups through a pipeline but the "investment" is program admission, not a check.

**Schema implication:** Add `referred` to the `investor_deals.stage` CHECK constraint for scouts:

```sql
CHECK (stage IN ('watching', 'interested', 'in_talks', 'due_diligence',
                 'invested', 'referred', 'passed'))
```

---

### Q: What does the investor onboarding/verification form look like?

**It's a modal, not a page.** Triggered from the slim banner on `/startups`.

**Form layout (conditional fields based on type):**

```
┌─────────────────────────────────────────────┐
│  Verify as Investor                          │
│  Access deal flow, financials, pitch decks.  │
│                                             │
│  I am a...                                  │
│  [Angel ▾]  ← dropdown                     │
│                                             │
│  Firm / Fund name                           │
│  [________________]                         │
│                                             │
│  ── shown if scout ──────────────────────── │
│  Which fund do you scout for?               │
│  [________________]                         │
│  ─────────────────────────────────────────── │
│                                             │
│  LinkedIn profile URL                       │
│  [________________]                         │
│                                             │
│  Investment thesis (2-3 sentences)          │
│  [________________________________]        │
│  [________________________________]        │
│                                             │
│  ── shown if angel/vc/family_office ─────── │
│  Check size range                           │
│  [₹5L ▾]  to  [₹25L ▾]                   │
│  ─────────────────────────────────────────── │
│                                             │
│  Preferred stages (optional)                │
│  [Pre-seed] [Seed] [Series A] [Series B+]  │
│                                             │
│  Preferred sectors (optional)               │
│  [SaaS] [Fintech] [Healthtech] [AI] [D2C]  │
│                                             │
│  [Apply for Verification]                   │
│                                             │
│  We review applications within 48 hours.    │
│  You'll keep full access while we verify.   │
└─────────────────────────────────────────────┘
```

**Copy rules applied:**
- "Verify as Investor" — 3 words, active voice
- "Access deal flow, financials, pitch decks." — benefit, not feature
- "We review applications within 48 hours." — reassurance, specific timeframe
- "You'll keep full access while we verify." — reassurance about loss

**What happens after submit:**
1. `investor_profiles` row created with form data
2. `users.investor_status = 'applied'`
3. Admin gets notification to review
4. User continues using platform normally
5. On approval: `users.investor_status = 'verified'`, `users.investor_verified_at = now()`
6. User gets notification + "Verified Investor" badge appears
