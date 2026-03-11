# Investor Features — Implementation Notes

## Overview

The investor system follows an "additive capabilities" model. Nobody is declared an investor at signup. Instead, any user can apply for verification, and the system unlocks deal-flow tools progressively once verified.

---

## Data Model

### `users` table additions

```sql
investor_status  text  DEFAULT 'none'
  CHECK (investor_status IN ('none', 'applied', 'verified', 'rejected'))

investor_verified_at  timestamptz  -- set when admin verifies

primary_interest  text  DEFAULT 'exploring'
  CHECK (primary_interest IN ('exploring', 'building', 'investing'))

looking_for  text[]  DEFAULT '{}'  -- co-founder, talent, funding, etc.
linkedin     text
```

`investor_status` is the state machine:
```
none → applied → verified
               → rejected
```

### `investor_profiles` table

Stores the application/profile data for investors. One row per user (upserted on apply).

Key columns added beyond the original schema:
- `affiliated_fund` — for scouts, the fund they scout for
- `investor_type` expanded to include: `scout`, `syndicate_lead`, `government`

### `investor_deals` table (new)

Powers the investor pipeline. One row per (investor, startup) pair.

```sql
investor_id  uuid  → users.id
startup_id   uuid  → startup_profiles.id
stage        text  -- watching | interested | in_talks | due_diligence | invested | referred | passed
instrument   text  -- safe | equity | convertible_note | other (nullable)
UNIQUE (investor_id, startup_id)
```

### `investor_deal_activity` table (new)

Append-only log of deal activity (stage changes, notes, etc.).

```sql
deal_id        uuid  → investor_deals.id
actor_id       uuid  → users.id
activity_type  text  -- stage_change | note_added | meeting_scheduled | document_shared | message
from_stage     text  (nullable)
to_stage       text  (nullable)
content        text  (nullable)
```

---

## Verification Flow

### 1. CTA surface

On `/startups` (Directory tab), when `investor_status === 'none'`, a subtle banner appears:
> "Verify as investor — Access deal flow and pipeline tools" [Get Verified button]

### 2. Application modal (`src/components/investor/InvestorVerifyModal.tsx`)

A standard fixed-overlay modal with:
- Investor type select (angel, vc, scout, syndicate_lead, family_office, accelerator, corporate_vc, government)
- Firm/fund name — label changes to "Fund / Network (optional)" for angels
- Affiliated fund — only rendered when `investor_type === 'scout'`
- Check size min/max
- Preferred stages (multi-select chips)
- Preferred sectors (multi-select chips from 12 suggestions)
- LinkedIn URL (required)
- Website (optional)
- Location
- Investment thesis (textarea, optional)

Validation: `investor_type` and `linkedin` are required. All other fields are optional.

### 3. API endpoint (`src/app/api/investor/apply/route.ts`)

POST handler:
1. Validates `investor_type` against the 8 allowed values
2. Checks `investor_status` — rejects if already `verified` or `applied`
3. Upserts a row in `investor_profiles` (on conflict for `user_id`)
4. Updates `users.investor_status = 'applied'`

No admin interface is built yet — verification is manual (admin updates `investor_status = 'verified'` directly in the DB).

After submitting, the modal closes and the local state flips to `'applied'`, which hides the CTA banner (it only shows for `'none'`).

---

## Deal Flow (Pipeline)

### API wrapper (`src/api/investor-deals.ts`)

Five functions over the `investor_deals` table:

| Function | What it does |
|---|---|
| `fetchDealFlow(investorId)` | All deals for this investor, joined with startup info |
| `createDeal(investorId, startupId)` | Adds startup to pipeline at `stage: 'watching'` |
| `updateDealStage(dealId, stage)` | Moves deal to a new stage |
| `addDealNote(dealId, actorId, note)` | Inserts a `note_added` activity row |
| `removeDeal(dealId)` | Deletes the deal row |
| `getDealForStartup(investorId, startupId)` | Checks if a startup is already in pipeline |

The `startup` field on `InvestorDeal` is a joined object:
```ts
startup?: {
  id, brand_name, logo_url, stage, city, sector, is_actively_raising, elevator_pitch
}
```

### Deal Flow tab (`src/components/investor/DealFlowTab.tsx`)

Rendered under `/startups` when `activeTab === 'dealflow'`. Visible only if `investor_status === 'verified'`.

- Stage filter pills at the top (only shows stages that have deals)
- Each deal card: startup logo + name (link to profile), stage/sector/raising metadata, stage dropdown, remove button
- Empty state with instruction to browse the directory

### "Add to Pipeline" button (`src/app/startups/[id]/page.tsx`)

Shown in the top-right of the startup detail page when the viewer is a verified investor who isn't the owner or co-founder.

Two states:
1. **Not in pipeline** → "Add to Pipeline" button → calls `createDeal`
2. **In pipeline** → stage dropdown (inline, emerald-colored) + remove button

The investor status and existing deal are fetched in parallel on mount. If not verified, the button is invisible — no UI noise for non-investors.

---

## Tab System on `/startups`

Three tabs, visibility gated:

| Tab | Visible when |
|---|---|
| Directory | Always |
| My Startup | User has a `startup_profile` |
| Deal Flow | `investor_status === 'verified'` |

Tab state is initialized from `?tab=` URL param (so `/startups?tab=my` works as a direct link). The old `/startups/my` page now redirects to `/startups?tab=my`.

The meta fetch (my startup + investor status) runs in parallel on mount inside `StartupsPageContent`.

---

## Settings Integration

Under Settings → Preferences → "Your Interests", users can set their `primary_interest` to `exploring`, `building`, or `investing`. This is a soft signal — it doesn't gate any features, just informs the feed ranking algorithm. The investing option doesn't auto-grant investor access; that still requires the application flow.

---

## Profile Integration

On any user's profile page:
- "Looking For" chips shown if `user.looking_for` is non-empty (violet color scheme)
- "Investor Info" section shown if the profile user has `investor_status === 'verified'`, displaying their firm, type, check size, preferred stages/sectors, and thesis fetched from `investor_profiles`

Users can set `looking_for` and `linkedin` via the edit profile form.

---

## RLS Policies

Both new tables use row-level security:

**`investor_deals`**
- SELECT/INSERT/UPDATE/DELETE: `investor_id = auth.uid()`

**`investor_deal_activity`**
- SELECT: deal's `investor_id = auth.uid()`
- INSERT: `actor_id = auth.uid()`

This means investors can only see and modify their own pipeline. There is no shared-access model currently (e.g., a fund team can't share a pipeline).

---

## What's Not Built Yet

- **Admin verification UI** — currently manual DB update to flip `investor_status = 'verified'`
- **Founder side of deals** — founders can't see who has them in their pipeline (the data exists in `investor_deals`, just no UI for it)
- **Deal activity log UI** — `investor_deal_activity` is written to (via `addDealNote`) but there's no timeline/history view yet
- **Email notification on verification** — no email sent when admin approves
- **Multi-user pipeline sharing** — no team/fund-level access to deals
