# Startup Profile — Deep Dive

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Data Model & Types](#data-model--types)
4. [Profile Creation Flow](#profile-creation-flow)
5. [Read Operations](#read-operations)
6. [Update & Delete Operations](#update--delete-operations)
7. [Authentication & Authorization](#authentication--authorization)
8. [API Endpoints](#api-endpoints)
9. [UI Component Architecture](#ui-component-architecture)
10. [Search & Filtering](#search--filtering)
11. [File Storage (Pitch Decks)](#file-storage-pitch-decks)
12. [Visibility & Publishing](#visibility--publishing)
13. [Bookmarks & View Tracking](#bookmarks--view-tracking)
14. [Key Workflows](#key-workflows)
15. [File Map](#file-map)
16. [Tech Stack](#tech-stack)

---

## Overview

The Startup Profile system is the core feature of the platform, allowing founders to create, publish, and manage a public-facing profile for their startup. Investors and other users can discover startups, filter by stage or fundraising status, bookmark interesting ones, and view detailed information including team, funding history, and pitch decks.

A startup profile is **owned by a single user** (the founder who created it). It goes through a multi-step creation wizard, can be saved as a draft, and when published becomes discoverable on the public `/startups` listing page.

---

## Database Schema

The system uses **Supabase PostgreSQL** with a primary table and five related tables.

### `startup_profiles` (Primary Table)

| Column               | Type           | Required | Description                                      |
| -------------------- | -------------- | -------- | ------------------------------------------------ |
| `id`                 | `string` (PK)  | Yes      | Unique identifier (UUID)                         |
| `owner_id`           | `string` (FK)  | Yes      | References `auth.users` — the creator            |
| `brand_name`         | `string`        | Yes      | Public display name of the startup               |
| `registered_name`    | `string`        | No       | Legal/registered company name                    |
| `legal_status`       | `enum`          | Yes      | One of: `llp`, `pvt_ltd`, `sole_proprietorship`, `not_registered` |
| `cin`                | `string`        | No       | CIN/LLPIN (shown only for LLP or Pvt Ltd)        |
| `stage`              | `enum`          | Yes      | One of: `ideation`, `mvp`, `scaling`, `expansion`, `maturity` |
| `description`        | `text`          | No       | About the startup                                |
| `keywords`           | `string[]`      | No       | Array of sector/industry tags                    |
| `website`            | `string`        | No       | Company website URL                              |
| `founded_date`       | `date`          | No       | When the startup was founded                     |
| `registered_address` | `string`        | No       | Legal address                                    |
| `startup_email`      | `string`        | Yes      | Contact email                                    |
| `startup_phone`      | `string`        | Yes      | Contact phone number                             |
| `pitch_deck_url`     | `string`        | No       | Public URL to uploaded pitch deck PDF             |
| `is_actively_raising`| `boolean`       | Yes      | Toggles "Raising" badge on the profile           |
| `visibility`         | `enum`          | Yes      | `public`, `investors_only`, or `private`         |
| `is_published`       | `boolean`       | Yes      | `false` = draft, `true` = live on discovery page |
| `created_at`         | `timestamp`     | Yes      | Auto-set on creation                             |
| `updated_at`         | `timestamp`     | Yes      | Auto-updated on modification                     |

### `startup_founders` (Team Members)

| Column         | Type      | Required | Description                    |
| -------------- | --------- | -------- | ------------------------------ |
| `id`           | `string`  | Yes      | UUID                           |
| `startup_id`   | `string`  | Yes      | FK → `startup_profiles.id`     |
| `name`         | `string`  | Yes      | Founder's full name            |
| `linkedin_url` | `string`  | No       | LinkedIn profile URL           |
| `display_order`| `number`  | Yes      | Controls rendering order       |
| `created_at`   | `timestamp`| Yes     | Auto-set                       |

### `startup_funding_rounds` (Investment History)

| Column       | Type      | Required | Description                                               |
| ------------ | --------- | -------- | --------------------------------------------------------- |
| `id`         | `string`  | Yes      | UUID                                                      |
| `startup_id` | `string`  | Yes      | FK → `startup_profiles.id`                                |
| `investor`   | `string`  | No       | Investor name                                             |
| `amount`     | `string`  | No       | Display string, e.g. "$500K"                              |
| `round_type` | `enum`    | Yes      | `pre_seed`, `seed`, `series_a`, `series_b`, `series_c`, `other` |
| `round_date` | `date`    | No       | When the round closed                                     |
| `is_public`  | `boolean` | Yes      | Whether this round is visible to non-owners               |
| `created_at` | `timestamp`| Yes     | Auto-set                                                  |

### `startup_incubators` (Accelerator Programs)

| Column         | Type      | Required | Description                |
| -------------- | --------- | -------- | -------------------------- |
| `id`           | `string`  | Yes      | UUID                       |
| `startup_id`   | `string`  | Yes      | FK → `startup_profiles.id` |
| `program_name` | `string`  | Yes      | Name of the program        |
| `year`         | `number`  | No       | Year of participation      |
| `created_at`   | `timestamp`| Yes     | Auto-set                   |

### `startup_awards` (Recognition)

| Column       | Type      | Required | Description                |
| ------------ | --------- | -------- | -------------------------- |
| `id`         | `string`  | Yes      | UUID                       |
| `startup_id` | `string`  | Yes      | FK → `startup_profiles.id` |
| `award_name` | `string`  | Yes      | Name of the award          |
| `year`       | `number`  | No       | Year awarded               |
| `created_at` | `timestamp`| Yes     | Auto-set                   |

### `startup_bookmarks` (User Favorites)

| Column       | Type     | Required | Description                     |
| ------------ | -------- | -------- | ------------------------------- |
| `user_id`    | `string` | Yes      | FK → `auth.users`               |
| `startup_id` | `string` | Yes      | FK → `startup_profiles.id`      |

Composite primary key on (`user_id`, `startup_id`).

### `startup_profile_views` (Analytics)

| Column       | Type      | Required | Description                        |
| ------------ | --------- | -------- | ---------------------------------- |
| `startup_id` | `string`  | Yes      | FK → `startup_profiles.id`         |
| `viewer_id`  | `string`  | No       | FK → `auth.users` (null = anon)    |

### Entity Relationship Diagram (Conceptual)

```
auth.users
    │
    ├── 1:1 ── startup_profiles (owner_id)
    │               │
    │               ├── 1:N ── startup_founders
    │               ├── 1:N ── startup_funding_rounds
    │               ├── 1:N ── startup_incubators
    │               ├── 1:N ── startup_awards
    │               ├── 1:N ── startup_profile_views
    │               └── N:M ── startup_bookmarks ── auth.users
    │
    └── (user can bookmark many startups)
```

---

## Data Model & Types

All TypeScript types and data-fetching functions live in a single file:

**`/src/api/startups.ts`**

Key types:

```ts
type LegalStatus = 'llp' | 'pvt_ltd' | 'sole_proprietorship' | 'not_registered';

type StartupStage = 'ideation' | 'mvp' | 'scaling' | 'expansion' | 'maturity';

type Visibility = 'public' | 'investors_only' | 'private';

type RoundType = 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'other';

interface StartupProfile {
  id: string;
  owner_id: string;
  brand_name: string;
  registered_name: string | null;
  legal_status: LegalStatus;
  cin: string | null;
  stage: StartupStage;
  description: string | null;
  keywords: string[];
  website: string | null;
  founded_date: string | null;
  registered_address: string | null;
  startup_email: string;
  startup_phone: string;
  pitch_deck_url: string | null;
  is_actively_raising: boolean;
  visibility: Visibility;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}
```

Functions exported from this file include:
- `createStartup(data)` — inserts a new profile
- `updateStartup(id, data)` — patches an existing profile
- `deleteStartup(id)` — removes a profile
- `fetchStartups(filters)` — paginated list with filters
- `fetchStartupById(id, userId?)` — single profile with bookmark status
- `fetchMyStartup(ownerId)` — owner's own profile
- `upsertFounders(startupId, founders[])` — replace founder list
- `upsertFundingRounds(startupId, rounds[])` — replace funding rounds
- `upsertIncubators(startupId, incubators[])` — replace incubator list
- `upsertAwards(startupId, awards[])` — replace awards list
- `uploadPitchDeck(file, userId)` — upload PDF to Supabase storage
- `bookmarkStartup(userId, startupId)` — add bookmark
- `unbookmarkStartup(userId, startupId)` — remove bookmark
- `recordProfileView(startupId, viewerId?)` — fire-and-forget view tracking

---

## Profile Creation Flow

Profile creation uses a **multi-step wizard** pattern at `/startups/create`.

### Step-by-Step Breakdown

```
┌──────────────────────────────────────────────────────────────┐
│  Step 0: Basic Identity                                      │
│  ─────────────────────                                       │
│  • Brand Name (required)                                     │
│  • Registered Name (optional)                                │
│  • Legal Status (required, radio select)                     │
│  • CIN/LLPIN (conditional — only for LLP or Pvt Ltd)         │
├──────────────────────────────────────────────────────────────┤
│  Step 1: Current Stage                                       │
│  ────────────────────                                        │
│  • Stage selection (required, visual cards):                 │
│    - Ideation    → Blue/Cyan gradient                        │
│    - MVP         → Purple/Pink gradient                      │
│    - Scaling     → Green/Emerald gradient                    │
│    - Expansion   → Orange/Amber gradient                     │
│    - Maturity    → Red/Rose gradient                         │
├──────────────────────────────────────────────────────────────┤
│  Step 2: Profile Details                                     │
│  ──────────────────────                                      │
│  • Description (textarea)                                    │
│  • Keywords / Sectors (tag input — add/remove pills)         │
│  • Website URL                                               │
│  • Founded Date                                              │
│  • Registered Address                                        │
│  • Startup Email (required)                                  │
│  • Startup Phone (required)                                  │
│  • Pitch Deck Upload (PDF only, Supabase Storage)            │
├──────────────────────────────────────────────────────────────┤
│  Step 3: Team / Founders                                     │
│  ────────────────────────                                    │
│  • Add multiple founders                                     │
│  • Each founder: Name (required) + LinkedIn URL (optional)   │
│  • Drag-to-reorder (GripVertical handle)                     │
│  • Remove individual founders                                │
├──────────────────────────────────────────────────────────────┤
│  Step 4: Funding & Recognition                               │
│  ────────────────────────────                                │
│  • "Actively Raising" toggle (boolean switch)                │
│  • Funding Rounds (variable count):                          │
│    - Round type, amount, investor, date, public flag         │
│  • Incubators / Accelerators:                                │
│    - Program name, year                                      │
│  • Awards / Recognitions:                                    │
│    - Award name, year                                        │
├──────────────────────────────────────────────────────────────┤
│  Step 5: Preview                                             │
│  ──────────────                                              │
│  • Read-only render of all entered data                      │
│  • Two action buttons:                                       │
│    - "Save as Draft"  → is_published: false                  │
│    - "Publish"        → is_published: true                   │
└──────────────────────────────────────────────────────────────┘
```

### Internal Submission Logic

When the user clicks "Publish" or "Save as Draft":

1. **Main profile insert** — `createStartup()` is called with all core fields. Returns the new profile `id`.
2. **Pitch deck upload** — If a file was selected, `uploadPitchDeck(file, userId)` uploads the PDF to Supabase Storage under `media/pitch-decks/{userId}/{timestamp}-{filename}` and returns a public URL. The profile is then updated with this URL.
3. **Related data upserts** — The following run in parallel:
   - `upsertFounders(startupId, founders[])`
   - `upsertFundingRounds(startupId, rounds[])`
   - `upsertIncubators(startupId, incubators[])`
   - `upsertAwards(startupId, awards[])`
4. **Redirect** — On success:
   - Published → `/startups/{id}` (public profile page)
   - Draft → `/startups/my` (owner's dashboard)

### State Management

The wizard holds all form data in a single React `useState` object at the top level (`StartupCreateWizard`). Each step component receives the relevant slice of state and setter callbacks. Navigation between steps does not lose data — it stays in memory until submission.

---

## Read Operations

### Public Discovery Page — `/startups`

- Calls `GET /api/startups` with query params for pagination and filters.
- The API queries `startup_profiles` where `is_published = true`.
- Returns profiles with a count of related founders (used to show "N team members").
- Results displayed as `StartupCard` components in a responsive 2-column grid.
- Supports "Load More" pagination (offset-based, 20 per page).

### Single Profile View — `/startups/[id]`

- Calls `GET /api/startups/[id]`.
- Uses `fetchStartupById(id, userId)` which:
  - Fetches the main profile row.
  - Fetches all related data (founders, funding, incubators, awards) via joins or separate queries.
  - Checks bookmark status for the current user (if authenticated).
  - Records a profile view (fire-and-forget, does not block render).
- Owner views of their own profile do **not** count as views.
- Rendered by `StartupProfileView` component, which shows all sections with stage-appropriate color theming.

### Owner Dashboard — `/startups/my`

- Uses `fetchMyStartup(ownerId)` to get the owner's startup (1:1 relationship).
- Shows an overview card with:
  - Brand name, stage badge, publish status.
  - Stats: total views, team member count, funding round count.
  - Action buttons: View Profile, Edit Profile, Publish/Unpublish toggle.
- If no startup exists, shows a "Create Your Startup Profile" call-to-action.

---

## Update & Delete Operations

### Edit Flow — `/startups/[id]/edit`

- Uses the **same multi-step wizard** as creation, pre-populated with existing data.
- On load, fetches current profile and all related data, then hydrates form state.
- Ownership validation: compares `owner_id` to the current authenticated user's ID. If mismatch, redirects away.
- On save, calls:
  - `updateStartup(id, data)` for core fields
  - `upsertFounders / upsertFundingRounds / upsertIncubators / upsertAwards` in parallel for related data
  - `uploadPitchDeck()` if a new file was selected

### Delete

- `DELETE /api/startups/[id]` removes the profile.
- Related records are cleaned up via foreign key cascades in the database.

---

## Authentication & Authorization

### Authentication

The platform uses **Supabase Auth** with **Google OAuth** as the sign-in provider.

- `AuthContext` (`/src/context/AuthContext.tsx`) wraps the entire app and provides the current user's session.
- The Next.js middleware (`/src/middleware.ts`) checks the Supabase session on every request and sets an `x-user-id` header that API routes can read.

### Authorization Matrix

| Action                   | Auth Required | Owner Only | Notes                                      |
| ------------------------ | ------------- | ---------- | ------------------------------------------ |
| View published profiles  | No            | No         | Public access                              |
| View draft profiles      | Yes           | Yes        | Only the owner can see their own drafts    |
| Create a profile         | Yes           | N/A        | Any authenticated user                     |
| Edit a profile           | Yes           | Yes        | `owner_id` must match current user         |
| Delete a profile         | Yes           | Yes*       | *Ownership check exists at page level      |
| Publish / Unpublish      | Yes           | Yes        | Toggle via update operation                |
| Bookmark a profile       | Yes           | No         | Any authenticated user can bookmark any    |
| Record a view            | No            | No         | Anonymous views are tracked (viewer_id=null)|

### How Auth Flows Through the Stack

```
Browser Request
    │
    ▼
Middleware (/src/middleware.ts)
    │  Reads Supabase session cookie
    │  Sets x-user-id header if authenticated
    │
    ▼
API Route Handler (/src/app/api/startups/...)
    │  Reads x-user-id from request headers
    │  Returns 401 if header missing (for protected routes)
    │
    ▼
Data Layer (/src/api/startups.ts)
    │  Uses Supabase client with service role for DB operations
    │  Passes owner_id for ownership checks
    │
    ▼
Supabase PostgreSQL
```

---

## API Endpoints

All startup-related API routes live under `/src/app/api/startups/`.

### Main Routes

| Method   | Path                              | Auth | Description                                |
| -------- | --------------------------------- | ---- | ------------------------------------------ |
| `GET`    | `/api/startups`                   | No   | List published startups (paginated, filterable) |
| `POST`   | `/api/startups`                   | Yes  | Create a new startup profile               |
| `GET`    | `/api/startups/[id]`              | No   | Get a single startup with all related data |
| `PUT`    | `/api/startups/[id]`              | Yes  | Update a startup profile                   |
| `DELETE` | `/api/startups/[id]`              | Yes  | Delete a startup profile                   |

### Related Data Routes

| Method   | Path                                  | Auth | Description                    |
| -------- | ------------------------------------- | ---- | ------------------------------ |
| `GET`    | `/api/startups/[id]/founders`         | No   | Get founder list               |
| `PUT`    | `/api/startups/[id]/founders`         | Yes  | Replace founder list           |
| `GET`    | `/api/startups/[id]/funding`          | No   | Get funding rounds             |
| `PUT`    | `/api/startups/[id]/funding`          | Yes  | Replace funding rounds         |

### Interaction Routes

| Method   | Path                                  | Auth | Description                    |
| -------- | ------------------------------------- | ---- | ------------------------------ |
| `POST`   | `/api/startups/[id]/bookmark`         | Yes  | Bookmark a startup             |
| `DELETE` | `/api/startups/[id]/bookmark`         | Yes  | Remove a bookmark              |
| `POST`   | `/api/startups/[id]/view`             | No   | Record a profile view          |

### Query Parameters for `GET /api/startups`

| Param    | Type     | Description                             |
| -------- | -------- | --------------------------------------- |
| `limit`  | `number` | Results per page (default: 20)          |
| `offset` | `number` | Pagination offset                       |
| `stage`  | `string` | Filter by startup stage                 |
| `raising`| `boolean`| Filter to only actively-raising startups|
| `keyword`| `string` | Filter by keyword in the keywords array |
| `search` | `string` | Full-text search on brand_name and description |

---

## UI Component Architecture

All startup-related UI components live in `/src/components/startups/`.

### Component Tree

```
/startups/create (Page)
└── StartupCreateWizard
    ├── Progress Bar (step indicator)
    ├── Step1BasicIdentity
    ├── Step2CurrentStage
    ├── Step3ProfileDetails
    ├── Step4Team
    ├── Step5FundingRecognition
    └── StartupPreview

/startups (Page — Discovery)
├── StartupSearchBar
├── StartupFilters
└── StartupCard[]  (grid)

/startups/[id] (Page — Profile View)
└── StartupProfileView
    ├── Header (brand name, stage badge, raising badge)
    ├── Description section
    ├── Keywords/Tags
    ├── Contact Info
    ├── Team / Founders section
    ├── Funding History section
    ├── Incubators section
    ├── Awards section
    └── Pitch Deck link/embed

/startups/my (Page — Owner Dashboard)
└── Overview Card
    ├── Stats (views, team, funding)
    └── Actions (View, Edit, Publish toggle)
```

### Component Details

| Component                  | File                                  | Purpose                                          |
| -------------------------- | ------------------------------------- | ------------------------------------------------ |
| `StartupCreateWizard`      | `StartupCreateWizard.tsx`             | Multi-step form orchestrator, holds all state     |
| `Step1BasicIdentity`       | `Step1BasicIdentity.tsx`              | Brand name, registered name, legal status, CIN    |
| `Step2CurrentStage`        | `Step2CurrentStage.tsx`               | Visual stage selector with color-coded cards      |
| `Step3ProfileDetails`      | `Step3ProfileDetails.tsx`             | Description, keywords, contact, pitch deck upload |
| `Step4Team`                | `Step4Team.tsx`                       | Founder management — add, remove, reorder         |
| `Step5FundingRecognition`  | `Step5FundingRecognition.tsx`         | Funding rounds, incubators, awards, raising flag  |
| `StartupPreview`           | `StartupPreview.tsx`                  | Read-only preview of all wizard data              |
| `StartupProfileView`       | `StartupProfileView.tsx`             | Full public profile display                       |
| `StartupCard`              | `StartupCard.tsx`                     | Grid card for discovery listing                   |
| `StartupFilters`           | `StartupFilters.tsx`                  | Stage and raising-status filter pills             |
| `StartupSearchBar`         | `StartupSearchBar.tsx`               | Debounced text search input (400ms)               |

### Visual Design Patterns

- **Stage-specific color gradients** — Each stage has its own color palette used throughout the UI:
  - Ideation: Blue → Cyan
  - MVP: Purple → Pink
  - Scaling: Green → Emerald
  - Expansion: Orange → Amber
  - Maturity: Red → Rose
- **Glassmorphism cards** — `backdrop-blur-xl` with semi-transparent backgrounds
- **Keyword pills** — Rounded tags that can be added/removed
- **Drag-to-reorder** — Founders list uses GripVertical handles for reordering
- **Toggle switches** — Used for boolean flags like "Actively Raising"
- **Responsive grid** — `md:grid-cols-2` layout for card listings

---

## Search & Filtering

The discovery page (`/startups`) provides multiple ways to find startups:

### Text Search
- Input field with **400ms debounce** to avoid excessive API calls.
- Searches across `brand_name` and `description` using PostgreSQL `ilike` queries.

### Stage Filter
- Pill-style buttons for each of the 5 stages.
- Single-select: clicking a stage filters to that stage only.
- Click again to deselect (show all stages).

### Raising Status Filter
- Toggle to show only startups that are actively raising funds.
- Adds `is_actively_raising = true` to the query.

### Keyword Filter
- Filters by matching keywords in the `keywords` array column.
- Uses PostgreSQL array containment operator.

### Combined Filtering
All filters can be combined. The API builds the query dynamically:

```
SELECT * FROM startup_profiles
WHERE is_published = true
  AND (stage = :stage OR :stage IS NULL)
  AND (is_actively_raising = true OR :raising IS NULL)
  AND (keywords @> ARRAY[:keyword] OR :keyword IS NULL)
  AND (brand_name ILIKE '%:search%' OR description ILIKE '%:search%' OR :search IS NULL)
ORDER BY created_at DESC
LIMIT :limit OFFSET :offset
```

---

## File Storage (Pitch Decks)

Pitch deck PDFs are stored in **Supabase Storage**.

### Upload Flow

1. User selects a PDF file in Step 2 of the wizard.
2. Client-side validation: only `.pdf` files accepted.
3. On form submission, `uploadPitchDeck(file, userId)` is called.
4. File is uploaded to the `media` bucket under the path:
   ```
   pitch-decks/{userId}/{timestamp}-{originalFilename}
   ```
5. Supabase returns a **public URL** for the uploaded file.
6. The public URL is saved to `startup_profiles.pitch_deck_url`.

### Access

- Pitch deck URLs are public (anyone with the URL can access).
- The URL is displayed as a link/button on the profile view page.
- Re-uploading during edit replaces the old URL (old file remains in storage).

---

## Visibility & Publishing

Startup profiles have two layers of visibility control:

### Publishing Status (`is_published`)

| State          | Discoverable | Direct URL Access | Shown in `/startups/my` |
| -------------- | ------------ | ----------------- | ----------------------- |
| Draft (false)  | No           | Owner only        | Yes                     |
| Published (true)| Yes          | Everyone          | Yes                     |

- Owners can toggle publish status at any time from the owner dashboard.
- Unpublishing immediately removes the profile from the discovery page.

### Visibility Setting (`visibility`)

Three levels are stored in the database:

- `public` — Visible to everyone
- `investors_only` — Intended for verified investors only
- `private` — Only visible to the owner

> **Note:** The `visibility` field is stored but not currently enforced by query filters. All published profiles are treated as public regardless of this setting. This is a feature that may be implemented in a future iteration.

---

## Bookmarks & View Tracking

### Bookmarks

- Any authenticated user can bookmark a startup profile.
- Bookmarks are stored in the `startup_bookmarks` table (simple join table).
- When viewing a profile, the API checks if the current user has bookmarked it and returns a `is_bookmarked` boolean.
- Bookmark/unbookmark is a toggle — `POST` to add, `DELETE` to remove.

### View Tracking

- Every visit to `/startups/[id]` triggers a `POST /api/startups/[id]/view`.
- The request is fire-and-forget (does not block page render).
- If the viewer is authenticated, `viewer_id` is recorded; otherwise it's `null`.
- Owner views are **not** counted (the API skips recording if `viewer_id === owner_id`).
- Total view count is displayed on the owner dashboard.

---

## Key Workflows

### Creating a Startup Profile

```
User navigates to /startups/create
    │
    ▼
Auth check — redirect to login if not authenticated
    │
    ▼
Step 0-4: Fill in all form fields across wizard steps
    │
    ▼
Step 5: Preview all entered data
    │
    ├── Click "Save as Draft"
    │       │
    │       ▼
    │   createStartup({ ..., is_published: false })
    │   + upload pitch deck + upsert related data
    │       │
    │       ▼
    │   Redirect → /startups/my
    │
    └── Click "Publish"
            │
            ▼
        createStartup({ ..., is_published: true })
        + upload pitch deck + upsert related data
            │
            ▼
        Redirect → /startups/{id}
```

### Discovering and Bookmarking

```
User navigates to /startups
    │
    ▼
See grid of published startup cards
    │
    ├── Use search bar (400ms debounce)
    ├── Click stage filter pills
    ├── Toggle "Raising" filter
    │
    ▼
Click a startup card
    │
    ▼
Navigate to /startups/{id}
    │  (view is recorded automatically)
    │
    ▼
See full profile details
    │
    └── Click bookmark icon → toggle bookmark status
```

### Managing Your Profile

```
User navigates to /startups/my
    │
    ▼
See overview card with stats
    │
    ├── Click "View Profile" → /startups/{id}
    │
    ├── Click "Edit Profile" → /startups/{id}/edit
    │       │
    │       ▼
    │   Same wizard UI, pre-populated with existing data
    │   Make changes → Save
    │
    └── Click "Publish" / "Unpublish"
            │
            ▼
        Toggle is_published via updateStartup()
```

---

## File Map

| File Path                                          | Purpose                                    |
| -------------------------------------------------- | ------------------------------------------ |
| `src/api/startups.ts`                              | All types, data fetching, and mutation functions |
| `src/app/startups/page.tsx`                        | Discovery/listing page                     |
| `src/app/startups/create/page.tsx`                 | Create wizard entry point                  |
| `src/app/startups/[id]/page.tsx`                   | Single profile view page                   |
| `src/app/startups/[id]/edit/page.tsx`              | Edit profile page                          |
| `src/app/startups/my/page.tsx`                     | Owner dashboard page                       |
| `src/app/api/startups/route.ts`                    | `GET` (list) + `POST` (create) endpoints   |
| `src/app/api/startups/[id]/route.ts`               | `GET` / `PUT` / `DELETE` single profile    |
| `src/app/api/startups/[id]/bookmark/route.ts`      | `POST` / `DELETE` bookmark                 |
| `src/app/api/startups/[id]/view/route.ts`          | `POST` record view                         |
| `src/app/api/startups/[id]/founders/route.ts`      | `GET` / `PUT` founders                     |
| `src/app/api/startups/[id]/funding/route.ts`       | `GET` / `PUT` funding rounds               |
| `src/components/startups/StartupCreateWizard.tsx`  | Multi-step wizard orchestrator             |
| `src/components/startups/Step1BasicIdentity.tsx`   | Step 0 form                                |
| `src/components/startups/Step2CurrentStage.tsx`    | Step 1 form                                |
| `src/components/startups/Step3ProfileDetails.tsx`  | Step 2 form                                |
| `src/components/startups/Step4Team.tsx`            | Step 3 form                                |
| `src/components/startups/Step5FundingRecognition.tsx` | Step 4 form                             |
| `src/components/startups/StartupPreview.tsx`       | Step 5 preview                             |
| `src/components/startups/StartupProfileView.tsx`   | Public profile display                     |
| `src/components/startups/StartupCard.tsx`          | Grid card for listings                     |
| `src/components/startups/StartupFilters.tsx`       | Filter pill components                     |
| `src/components/startups/StartupSearchBar.tsx`     | Search input component                     |
| `src/middleware.ts`                                | Auth middleware (sets user ID header)       |
| `src/context/AuthContext.tsx`                      | Global auth context provider               |

---

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Framework    | Next.js (App Router)                |
| Language     | TypeScript                          |
| UI           | React + Tailwind CSS                |
| Icons        | Lucide React                        |
| Database     | Supabase (PostgreSQL)               |
| Auth         | Supabase Auth + Google OAuth        |
| Storage      | Supabase Storage (pitch deck PDFs)  |
| State        | React hooks (`useState`, `useEffect`, `useCallback`) |
| Deployment   | Vercel (inferred from Next.js)      |