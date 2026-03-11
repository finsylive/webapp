# Design Decisions — Ments Webapp

## Auth: Supabase + Google OAuth only

- Single sign-on via Google OAuth (no email/password auth)
- Session managed via cookie (`sb-web-auth`), validated in `middleware.ts` on every request
- Two Supabase clients intentionally separated:
  - `createAuthClient()` — user context, RLS enforced
  - `createAdminClient()` — service role, bypasses RLS — only used where user-scoped queries are insufficient (e.g. sending co-founder invitations to non-users)
- Email verification is an additional layer on top of OAuth (6-digit code) for trust building

## Database: Supabase SDK over ORM

- No Prisma/Drizzle — queries written directly using Supabase JS SDK (PostgREST)
- Decision: avoids ORM abstraction overhead, keeps queries explicit and close to SQL
- RLS policies at the DB level are the primary security layer — not application-level guards

## Feed: AI Ranking with Fallback

- Groq LLM ranks candidate posts by relevance to user interest profile
- Full fallback to chronological feed if AI pipeline fails (resilience over feature completeness)
- Feed cached per user to avoid re-running the expensive pipeline on every load
- A/B experiment framework built in — new ranking models can be tested against a control group without a code deploy

## Feed Onboarding: No Explicit Interest Picker

- Decision: no topic/interest selection UI during onboarding — interest profiles are built entirely from user behavior (likes, replies, shares, dwell time)
- Ments is a niche founder community — content is mostly startups/tech/product, so the cold start problem is mild (first feed is already relevant)
- Behavior-derived profiles are more accurate than self-reported ones (what users engage with ≠ what they say they like)
- Extra onboarding steps reduce completion rate — not worth the tradeoff at current scale
- Level 2 interest profiles build within 1-2 sessions (~20-30 interactions); the gap is one generic session, not weeks
- The follow-people step during signup already seeds the follow-graph signal (20% of ranking formula), which is sufficient for a reasonable first feed
- Revisit if: first-session feedback is consistently poor, content diversity expands beyond founder topics, or a large public launch demands stronger first impressions

## Caching: Upstash Redis + Postgres Dual-Write (Level 2)

- Feed cache and interest profiles use 3-layer caching: in-memory Map → Upstash Redis → Postgres
- Redis is the primary fast cache (~5-20ms); Postgres is the durable backup (~50-150ms)
- Upstash free tier (500K ops/month) covers beta scale (~3K DAU before hitting limit)
- Graceful degradation: if Redis is unconfigured or fails, falls back to Postgres-only (Level 1 behavior)
- General app caching still uses in-memory Map-based TTL cache (`lib/cache.ts`) — Redis is feed-engine-only
- Feed pipeline removed Groq LLM re-ranking stage — Tier 1 deterministic scoring only (no external API dependency)

## Storage: Supabase Storage + S3

- User avatars, startup logos/banners, project slides → Supabase Storage
- Larger media / public assets → AWS S3 bucket (`ments-public`)
- Video processed client-side with FFmpeg WASM before upload to reduce server load

## Co-Founder Invitations

- Founders can invite by email (external) or Ments username (internal)
- Invited founders stored in `startup_founders` with `status: pending`
- Pending founders hidden from public startup page — visible only to owner/co-founders
- Invited badge shown on profile when accepted but not yet a Ments user

## PWA

- `next-pwa` adds service worker + offline support
- Enables mobile app-like install on iOS/Android without native app
- Push notifications handled via `/api/push-notification`, `/api/push-on-mention`, `/api/push-on-reply`

## Component Architecture

- No component library (no shadcn, MUI, etc.) — all components built custom
- `class-variance-authority` (CVA) used for variant-based component styling
- Tailwind for all styling — no CSS modules or styled-components
- Framer Motion for animations — used selectively, not globally

## User Types: Additive Capabilities Model

- No hard `user_type` gating — everyone starts as an explorer (default `primary_interest: 'exploring'`)
- Founder status is earned by creating a `startup_profile` (not by selecting a role at onboarding)
- Investor status requires async verification: user submits application via modal → `investor_status: 'applied'` → admin verifies → `investor_status: 'verified'`
- `primary_interest` column is a soft signal for feed ranking, not an identity gate — users can change it anytime in Settings
- `user_type` column preserved for backward compatibility but `'normal_user'` is always set at onboarding
- Dashboard navigation is contextual: `/startups` shows Directory (all), My Startup (founders only), Deal Flow (verified investors only) as tabs
- Fundraising is placed on the company (`startup_profiles`) not the person — `is_actively_raising` toggle reveals raise_target, equity_offered, min_ticket_size, funding_stage, sector fields
- `investor_deals` table powers both investor pipeline and (future) founder funding pipeline — same rows, different queries
- Scout investors (`investor_type: 'scout'`) have `affiliated_fund` field for the fund they scout for
- Profile "Looking For" section (co-founder, talent, funding, mentorship, partnerships, beta_users) is additive for all users
- See `docs/usertype_ux_suggestion.md` for the full design rationale

## Entity Types: Org Projects + Startups (Approach E — Pragmatic Hybrid)

- `startup_profiles` table extended with `entity_type` column (`'org_project' | 'startup'`, default `'startup'`)
- Org projects (college clubs, hackathon teams, research groups) and startups coexist in the same table — shared discovery, ranking, and team management
- Personal projects remain entirely separate (not part of this system)
- Org projects skip startup-specific fields: legal structure, CIN, business model, fundraising, traction/financials, pitch deck, and investor-facing features
- `startup_email` and `startup_phone` made nullable — org projects don't require them
- Three new showcase tables: `startup_slides` (gallery), `startup_links` (external links), `startup_text_sections` (custom rich content sections) — available to both entity types but primarily designed for org project storytelling
- Create wizard branches by entity type: startups get 8 steps (Identity → Description → Branding → Positioning → Edge → Financials → Media → Publish), org projects get 5 steps (Identity → Description → Branding → Showcase → Publish)
- Edit page conditionally hides startup-only steps for org projects, adds ShowcaseEditor for text sections and links
- Discovery page: entity type filter pills (All / Startups / Org Projects), entity type badges on cards, "My Ventures" tab replaces "My Startup" to support multiple ventures
- Detail page: "Org Project" badge, hides financial sections and "Raising" badge, shows "Team" instead of "Founders", renders showcase content (text sections, gallery, links)
- Why single table: shared indexing for directory search, shared RLS policies, shared bookmarking/voting, shared view tracking — minimal duplication while keeping the codebase simple
- Migration: `supabase/migrations/015_org_projects.sql`

## Notifications

- Notifications fetched via POST `/api/notifications` (not GET) — allows sending user context in body rather than query params
- Real-time notification context via `context/NotificationsContext`
- Push notifications sent server-side on mention/reply events
