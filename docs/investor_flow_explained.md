# Investor Verification Flow — How It Works

## Overview

The investor flow follows an **apply-then-verify** model. Users express interest via a modal form, an admin manually approves or rejects, and verified investors unlock gated features (deal flow, financials, pitch decks).

---

## End-to-End Flow

```
User browses /startups
    |
    v
Sees banner: "Verify as investor — Access deal flow and pipeline tools"
    |
    v
Clicks banner -> InvestorVerifyModal opens
    |
    v
Fills form (investor_type, linkedin required; firm, thesis, check size optional)
    |
    v
POST /api/investor/apply
    |
    +--> Validates investor_type against 8 allowed values
    +--> Rejects if already 'applied' or 'verified'
    +--> Upserts row in `investor_profiles` table
    +--> Updates `users.investor_status = 'applied'`
    +--> Updates `users.linkedin`
    |
    v
User sees: "Verification in progress" (banner changes)
User keeps full access to all common features
    |
    v
*** MANUAL ADMIN STEP (no UI built) ***
Admin runs SQL in Supabase dashboard:
    UPDATE users SET investor_status = 'verified', investor_verified_at = now() WHERE id = '<user_id>';
    |
    v
On next page load, user sees:
    - "Deal Flow" tab on /startups
    - "Add to Pipeline" button on startup detail pages
    - "Verified Investor" badge on their profile
```

---

## What Exists Today

### Built and Working

| Component                           | Location                                          | Status                                       |
| ----------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| Verification modal form             | `src/components/investor/InvestorVerifyModal.tsx` | Working                                      |
| Apply API endpoint                  | `src/app/api/investor/apply/route.ts`             | Working                                      |
| `investor_profiles` table           | Migration 010                                     | Schema exists, upsert works                  |
| `investor_status` on users          | Migration 010                                     | `none` / `applied` / `verified` / `rejected` |
| CTA banner on /startups             | `src/app/startups/page.tsx`                       | Shows when `investor_status === 'none'`      |
| Deal Flow tab                       | `src/components/investor/DealFlowTab.tsx`         | Shows when `investor_status === 'verified'`  |
| Deal pipeline CRUD                  | `src/api/investor-deals.ts`                       | Create, update stage, add notes, remove      |
| "Add to Pipeline" on startup detail | `src/app/startups/[id]/page.tsx`                  | Verified investors only                      |
| Investor badge on profile           | `src/app/profile/[username]/page.tsx`             | Badge only (no firm details)                 |
| `investor_deals` table + RLS        | Migration 010                                     | Each investor sees only their own deals      |
| `investor_deal_activity` table      | Migration 010                                     | Activity logging works                       |

### NOT Built (Gaps)

| Feature                                  | Impact                                    | Workaround                                 |
| ---------------------------------------- | ----------------------------------------- | ------------------------------------------ |
| Admin verification dashboard             | Investors stuck in 'applied' forever      | Manual SQL update in Supabase dashboard    |
| Investor profile details on user profile | Firm name, thesis, check size never shown | Only badge appears                         |
| Founder-side pipeline visibility         | Founders can't see who's tracking them    | Data exists in `investor_deals`, no UI     |
| Deal activity timeline                   | Notes/stage changes logged but invisible  | No UI to view activity history             |
| Email notification on approval           | User has no idea they got verified        | Discovers on next login                    |
| Settings page for investor profile edits | Can't update application after submit     | Must re-apply (blocked by 'applied' check) |

---

## Database Tables Involved

### `users` (modified columns)

```
investor_status  text  DEFAULT 'none'   -- none | applied | verified | rejected
investor_verified_at  timestamptz       -- set by admin on approval
linkedin  text                          -- set during application
```

### `investor_profiles` (full table)

```
user_id           uuid     (FK -> users.id, UNIQUE)
firm_name         text     (optional — "Independent" for angels)
investor_type     text     (angel | vc | scout | syndicate_lead | family_office | accelerator | corporate_vc | government)
affiliated_fund   text     (only for scouts — "which fund do you scout for?")
check_size_min    text
check_size_max    text
preferred_stages  text[]   (ideation, mvp, scaling, expansion, maturity)
preferred_sectors text[]   (SaaS, FinTech, HealthTech, etc.)
thesis            text     (investment thesis, 2-3 sentences)
linkedin          text
website           text
location          text
is_actively_investing  boolean  (default true)
portfolio_count   integer  (default 0)
```

### `investor_deals` (pipeline)

```
investor_id    uuid     (FK -> users.id)
startup_id     uuid     (FK -> startup_profiles.id)
stage          text     (watching | interested | in_talks | due_diligence | invested | referred | passed)
notes          text
invested_amount text    (filled when stage = 'invested')
invested_date   date
instrument      text    (safe | equity | convertible_note | other)
UNIQUE(investor_id, startup_id)
```

RLS: investors can only see/modify their own deals.

### `investor_deal_activity` (activity log)

```
deal_id        uuid     (FK -> investor_deals.id, CASCADE delete)
actor_id       uuid     (FK -> users.id)
activity_type  text     (stage_change | note_added | meeting_scheduled | document_shared | message)
from_stage     text     (for stage_change)
to_stage       text     (for stage_change)
content        text     (note text, meeting details, etc.)
metadata       jsonb    (flexible: meeting link, document URL, etc.)
```

---

## API Details

### POST `/api/investor/apply`

**Input** (JSON body):

```json
{
  "investor_type": "angel", // REQUIRED — one of 8 types
  "linkedin": "https://...", // REQUIRED
  "firm_name": "Peak XV", // optional
  "affiliated_fund": "Sequoia", // optional, for scouts
  "check_size_min": "5L", // optional
  "check_size_max": "25L", // optional
  "preferred_stages": ["seed"], // optional
  "preferred_sectors": ["SaaS"], // optional
  "thesis": "...", // optional
  "website": "https://...", // optional
  "location": "Mumbai" // optional
}
```

**Logic**:

1. Auth check via `createAuthClient()` + `getUser()`
2. Validates `investor_type` against allowed list
3. Checks current `investor_status` — rejects if already `applied` or `verified`
4. Upserts into `investor_profiles` (uses admin client to bypass RLS)
5. Updates `users.investor_status = 'applied'` and `users.linkedin`
6. Returns `{ success: true, status: 'applied' }`

**Error cases**:

- 401: Not authenticated
- 400: Missing/invalid `investor_type` or `linkedin`
- 409: Already applied or verified
- 500: DB error

### Client-side deal functions (`src/api/investor-deals.ts`)

These use the Supabase browser client directly (not API routes):

- `fetchDealFlow(investorId)` — all deals with joined startup data
- `createDeal(investorId, startupId)` — creates at `stage: 'watching'`
- `updateDealStage(dealId, stage)` — moves deal through pipeline
- `addDealNote(dealId, actorId, note)` — logs `note_added` activity
- `removeDeal(dealId)` — deletes deal
- `getDealForStartup(investorId, startupId)` — checks if already in pipeline

---

## Verification Modal Form Fields

```
Required:
  Investor type          dropdown (8 options)
  LinkedIn profile URL   text input

Conditional:
  Affiliated fund        shown only if type = 'scout'

Optional:
  Firm / Fund name       text input (label: "Fund / Network" for angels)
  Check size range       min + max text inputs
  Preferred stages       multi-select chips (ideation, mvp, scaling, expansion, maturity)
  Preferred sectors      multi-select chips (12 options)
  Website                text input
  Location               text input
  Investment thesis      textarea
```

---

## Feature Gates (What Verified Investors See)

| Feature                              | Gate Check                                               | Location                              |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------- |
| "Deal Flow" tab on /startups         | `investor_status === 'verified'`                         | `src/app/startups/page.tsx`           |
| "Add to Pipeline" button             | `investor_status === 'verified'` AND not owner/cofounder | `src/app/startups/[id]/page.tsx`      |
| Stage dropdown on startup detail     | Deal exists for this investor+startup                    | `src/app/startups/[id]/page.tsx`      |
| "Verified Investor" badge on profile | `investor_status === 'verified'`                         | `src/app/profile/[username]/page.tsx` |

### NOT yet gated (planned):

- `visibility: 'investors_only'` startups (no filter exists)
- Pitch decks and financials (shown to everyone currently)
- "Raising Now" filter on directory (not built)

---

## How to Verify an Investor (Admin — Current Manual Process)

1. Check pending applications:

```sql
SELECT u.id, u.full_name, u.email, u.linkedin, ip.investor_type, ip.firm_name, ip.thesis
FROM users u
JOIN investor_profiles ip ON ip.user_id = u.id
WHERE u.investor_status = 'applied'
ORDER BY ip.created_at DESC;
```

2. Verify the LinkedIn profile (manual check)

3. Approve:

```sql
UPDATE users
SET investor_status = 'verified', investor_verified_at = now()
WHERE id = '<user_id>';
```

4. Reject:

```sql
UPDATE users
SET investor_status = 'rejected'
WHERE id = '<user_id>';
```

---

## What Needs to Be Built Next (Priority Order)

1. **Admin verification dashboard** — Review applications, approve/reject with one click
2. **Investor profile details on user profile** — Show firm, thesis, check size, sectors (data exists, display doesn't)
3. **Notification on approval** — In-app notification when `investor_status` changes to `verified`
4. **Founder pipeline visibility** — Let founders see which investors are tracking their startup
5. **Deal activity timeline** — Show stage change history and notes on each deal
6. **Settings page for investor profile** — Let investors update their application details
7. **`investors_only` visibility filter** — Hide sensitive startup data from non-verified users
