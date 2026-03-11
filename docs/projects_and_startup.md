# Projects & Startups — Deep Map

## Current State: Two Separate Worlds

Personal Projects and Startups are completely independent entities with no shared infrastructure.

---

## PROJECTS (Personal Portfolio)

### UX Flow

```
Profile Page (/profile/[username])
  └─ Shows up to 4 project cards inline
  └─ "+ Add" button → /profile/[username]/projects

Projects List (/profile/[username]/projects)
  └─ Grid of ProjectCards
  └─ Click card → Project View

Project View (/profile/[username]/projects/[id])
  └─ Cover image, title, tagline, category, date
  └─ Links section
  └─ Slides gallery (lightbox)
  └─ Text sections (case study body)
  └─ Owner: Edit / Delete menu

Project Edit (/profile/[username]/projects/[id]/edit)
  └─ Basic Info: title, tagline, URL, category, visibility
  └─ Cover image upload
  └─ Slides manager (upload, reorder, delete)
  └─ Inline links (add/delete)
  └─ Details: text sections (heading + body, reorder)
```

### Database Tables (4 tables)

```sql
projects
├── id          UUID PK
├── owner_id    UUID FK → users
├── title       TEXT NOT NULL
├── category    TEXT (e.g. "Web App", "AI / ML")
├── tagline     TEXT
├── url         TEXT (proof link)
├── cover_url   TEXT
├── logo_url    TEXT
├── visibility  TEXT (public|private|unlisted)
├── sort_order  INT DEFAULT 0
├── created_at  TIMESTAMPTZ

project_slides
├── id           UUID PK
├── project_id   UUID FK → projects
├── slide_url    TEXT NOT NULL
├── caption      TEXT
├── slide_number INT
├── created_at   TIMESTAMPTZ

project_links
├── id            UUID PK
├── project_id    UUID FK → projects
├── title         TEXT NOT NULL
├── url           TEXT NOT NULL
├── icon_name     TEXT
├── display_order INT
├── created_at    TIMESTAMPTZ

project_text_sections
├── id            UUID PK
├── project_id    UUID FK → projects
├── heading       TEXT NOT NULL
├── content       TEXT NOT NULL
├── display_order INT
├── created_at    TIMESTAMPTZ
```

### API Routes (12 endpoints)

```
GET/POST   /api/users/[username]/projects
GET/PUT/DEL /api/users/[username]/projects/[id]
GET/POST   /api/users/[username]/projects/[id]/slides
PUT/DEL    /api/users/[username]/projects/[id]/slides/[slideId]
GET/POST   /api/users/[username]/projects/[id]/links
PUT/DEL    /api/users/[username]/projects/[id]/links/[linkId]
GET/POST   /api/users/[username]/projects/[id]/text_sections
PUT/DEL    /api/users/[username]/projects/[id]/text_sections/[sectionId]
```

### What Projects DON'T Have

- Team / collaborators
- Funding / revenue
- Bookmarks / upvotes
- View tracking
- Discovery page (not browsable by strangers — only via profile visit)
- Stage / maturity
- Pitch deck
- Incubator / award affiliations

---

## STARTUPS (Venture Entity)

### UX Flow

```
Startup Directory (/startups)
  └─ Tab bar: Directory | My Startup | Deal Flow
  └─ Sort: Hot (most bookmarked) | New
  └─ Filter by stage: All|Ideation|MVP|Scaling|Expansion
  └─ Podium: Top 3 startups
  └─ Ranked list with upvote buttons
  └─ "+ List" button → /startups/create

Create Wizard (/startups/create) — 8 STEPS:
  Step 1: Identity (name, legal status, stage, location, email)
  Step 2: Description + Founders (add team, link Ments users)
  Step 3: Branding (logo + banner upload)
  Step 4: Positioning (categories, website, team size, tags)
  Step 5: Competitive Edge (USP, target audience)
  Step 6: Financials (revenue, traction, funding rounds,
          actively raising toggle → raise target, equity)
  Step 7: Media (pitch deck PDF, elevator pitch)
  Step 8: Visibility (public|investors_only|private)

Startup Detail (/startups/[id])
  └─ Banner + logo + stage badge + "Raising" badge
  └─ Bookmark/upvote button
  └─ Description, categories, keywords, location
  └─ Founders list (with Ments profile links)
  └─ Financials: revenue, traction, funding rounds
  └─ Contact: email, phone, address, legal info
  └─ Pitch deck link + elevator pitch
  └─ Owner: Edit button
  └─ Investor: Pipeline controls (stage selector)

My Startup tab (/startups?tab=my)
  └─ Card: name, stage, published/draft, raising badge
  └─ Stats: views, team count, funding rounds
  └─ Actions: View | Edit | Publish/Unpublish

Edit (/startups/[id]/edit) — same 7 step components
  └─ Danger Zone: Delete startup

Deal Flow tab (/startups?tab=dealflow) — verified investors only
  └─ Pipeline: watching → interested → in_talks →
     due_diligence → invested → referred → passed
```

### Database Tables (8 tables + investor_deals)

```sql
startup_profiles
├── id                UUID PK
├── owner_id          UUID FK → users
├── brand_name        TEXT NOT NULL
├── registered_name   TEXT
├── legal_status      TEXT (llp|pvt_ltd|sole_proprietorship|not_registered)
├── cin               TEXT
├── stage             TEXT (ideation|mvp|scaling|expansion|maturity)
├── description       TEXT
├── keywords          TEXT[]
├── website           TEXT
├── founded_date      TEXT
├── address_line1     TEXT
├── address_line2     TEXT
├── state             TEXT
├── city              TEXT
├── country           TEXT
├── startup_email     TEXT NOT NULL
├── startup_phone     TEXT NOT NULL
├── business_model    TEXT
├── categories        TEXT[]
├── team_size         TEXT
├── key_strengths     TEXT
├── target_audience   TEXT
├── revenue_amount    TEXT
├── revenue_currency  TEXT DEFAULT 'USD'
├── revenue_growth    TEXT
├── traction_metrics  TEXT
├── total_raised      TEXT
├── investor_count    INT
├── pitch_deck_url    TEXT
├── elevator_pitch    TEXT
├── logo_url          TEXT
├── banner_url        TEXT
├── is_actively_raising BOOLEAN NOT NULL
├── raise_target      TEXT
├── equity_offered    TEXT
├── min_ticket_size   TEXT
├── funding_stage     TEXT (pre_seed|seed|series_a|series_b|series_c|bridge)
├── sector            TEXT
├── visibility        TEXT (public|investors_only|private)
├── is_published      BOOLEAN NOT NULL
├── is_featured       BOOLEAN DEFAULT false
├── created_at        TIMESTAMPTZ
├── updated_at        TIMESTAMPTZ

startup_founders
├── id              UUID PK
├── startup_id      UUID FK → startup_profiles
├── name            TEXT NOT NULL
├── role            TEXT
├── email           TEXT
├── user_id         UUID FK → users (nullable)
├── ments_username  TEXT
├── avatar_url      TEXT
├── status          TEXT (pending|accepted|declined) DEFAULT 'accepted'
├── display_order   INT NOT NULL
├── created_at      TIMESTAMPTZ

startup_funding_rounds
├── id          UUID PK
├── startup_id  UUID FK → startup_profiles
├── investor    TEXT
├── amount      TEXT
├── round_type  TEXT (pre_seed|seed|series_a|series_b|series_c|other)
├── round_date  TEXT
├── is_public   BOOLEAN
├── created_at  TIMESTAMPTZ

startup_incubators
├── id            UUID PK
├── startup_id    UUID FK → startup_profiles
├── program_name  TEXT NOT NULL
├── year          INT
├── created_at    TIMESTAMPTZ

startup_awards
├── id          UUID PK
├── startup_id  UUID FK → startup_profiles
├── award_name  TEXT NOT NULL
├── year        INT
├── created_at  TIMESTAMPTZ

startup_bookmarks
├── user_id     UUID FK → users
├── startup_id  UUID FK → startup_profiles
├── (PK: user_id + startup_id)

startup_profile_views
├── startup_id  UUID FK → startup_profiles
├── viewer_id   UUID FK → users (nullable)
├── viewed_at   TIMESTAMPTZ

investor_deals (linked to startups)
├── id              UUID PK
├── investor_id     UUID FK → users
├── startup_id      UUID FK → startup_profiles
├── stage           TEXT (watching|interested|in_talks|due_diligence|invested|referred|passed)
├── notes           TEXT
├── invested_amount TEXT
├── invested_date   DATE
├── instrument      TEXT (safe|equity|convertible_note|other)
├── created_at      TIMESTAMPTZ
├── updated_at      TIMESTAMPTZ
├── UNIQUE(investor_id, startup_id)
```

### API Routes (8 endpoints)

```
GET/POST    /api/startups
GET/PUT/DEL /api/startups/[id]
GET/PUT     /api/startups/[id]/founders
GET/PUT     /api/startups/[id]/funding
POST        /api/startups/[id]/view
POST/DEL    /api/startups/[id]/bookmark
```

### What Startups DON'T Have (that Projects do)

- Slides / image gallery
- Text sections (case study body)
- Multiple external links
- Per-user profile embedding (lives at /startups, not /profile)

---

## Side-by-Side Comparison

| Feature | Projects | Startups |
|---|---|---|
| **URL** | `/profile/[username]/projects/[id]` | `/startups/[id]` |
| **Visible on profile** | Yes (up to 4 cards) | Only via `show_startups` toggle |
| **Discoverable by strangers** | No (only via profile visit) | Yes (ranked directory) |
| **Owner model** | Single `owner_id` | `owner_id` + `startup_founders[]` |
| **Team** | None | Founders with roles, invites, Ments linking |
| **Rich content** | Slides, text sections, links | Description only (text field) |
| **Media** | Cover image, slide gallery | Logo, banner, pitch deck PDF |
| **Funding** | None | Rounds, amounts, investors, raising toggle |
| **Investor visibility** | None | `investors_only` visibility, Deal Flow pipeline |
| **Bookmarks/Upvotes** | None | Yes (startup_bookmarks) |
| **View tracking** | None | Yes (startup_profile_views) |
| **Stage** | None | ideation / mvp / scaling / expansion / maturity |
| **Legal info** | None | Legal status, CIN, registered name |
| **Location** | None | Country, state, city, address |
| **Categories** | Single `category` field | `categories[]` array + `keywords[]` |
| **Visibility options** | public / private / unlisted | public / investors_only / private |
| **Creation UX** | Inline on edit page | 8-step wizard |
| **DB tables** | 4 | 8 (+ investor_deals) |
| **API endpoints** | 12 | 8 |

---

## Real-World Edge Cases

### 1. Avishkar Hyperloop (IIT Madras) — Org Project that spawned a Startup

- **Avishkar** = 76-student team under IIT Madras CFI. No revenue, no equity, students rotate yearly. This is an **org project**.
- **TuTr Hyperloop** = startup incubated at IIT Madras that commercializes Avishkar's R&D. Same people, same tech, different entity. This is a **startup**.
- Both coexist. Avishkar didn't become TuTr — TuTr spun off while Avishkar still runs.
- **Problem**: This is a fork, not a lifecycle transition. A type toggle doesn't model this.

### 2. Formula SAE / Formula Bharat Teams — Perpetual Org Projects

- 50+ college racing teams across India (BMS Bullz Racing, CRCE Formula Racing, etc.)
- 8-12 month build cycles, students rotate, corporate sponsors, but zero equity/revenue/investors.
- **They will never become startups.** A toggle implies they should, which is misleading UX.

### 3. Hackathon → Startup (Zapier, Talkdesk, GroupMe)

- Zapier: hackathon project → $5B company
- GroupMe: TechCrunch hackathon → acquired by Skype for $85M
- These are clean transitions: the project dies, the startup lives.
- **Problem**: No migration path from `projects` → `startup_profiles`. Slides/text content lost. URL structure breaks.

### 4. College Project → Startup (Ather Energy, Razorpay, Planys)

- Ather Energy: IIT Madras student project → $150M+ funded EV startup
- Razorpay: IIT Roorkee project → $7B unicorn
- Clean transition. Old project identity abandoned.

### 5. Diaspora — Startup that reverted to Community Project

- Open-source social network. Raised money, tried to be a startup, failed, reverted to community-maintained open-source.
- Went backwards on the lifecycle.
- **Problem**: No "downgrade" path from startup → project.

### 6. E-Cell parenting both types

- E-Cell IIT Bombay parents both student projects (clubs, competitions) AND startups (incubated companies).
- **Problem**: No `parent_org_id` on either table. No way for an E-Cell profile to show "our startups + our projects".

### 7. Shared team across entities

- Avishkar has 76 students. TuTr has 5 co-founders. Some people are in both.
- **Problem**: If both live in `startup_profiles`, `startup_founders` handles it fine. If they're in different tables, no cross-entity team linking.

### 8. Sponsored but not fundraising

- Formula SAE teams have corporate sponsors (ArcelorMittal sponsors Avishkar) but zero revenue/equity.
- **Problem**: `is_actively_raising` doesn't fit. They get grants/sponsorships, not investment.

---

## The Gap: What Org Projects Need

Org projects need a middle ground that neither table currently provides:

```
Feature needed by Org Projects:     Projects has:    Startups has:
──────────────────────────────      ─────────────    ─────────────
Team / collaborators                     No               Yes
Discovery / browsability                 No               Yes
Slides / rich content                    Yes              No
Text sections / case study               Yes              No
Multiple links                           Yes              No
Bookmarks / upvotes                      No               Yes
View tracking                            No               Yes
Stage                                    No               Yes
Incubator affiliation                    No               Yes
──────────────────────────────
Funding / raising                        No               Yes  ← NOT needed
Legal entity info                        No               Yes  ← NOT needed
Pitch deck                               No               Yes  ← Maybe
Investor pipeline                        No               Yes  ← NOT needed
Required email/phone                     No               Yes  ← NOT needed
```

An org project is essentially **startup_profiles' discovery + team + stage** combined with **projects' rich content (slides, sections, links)** — minus the funding/legal/investor machinery.

---

## Key File Locations

### Projects
| Component | Path |
|---|---|
| Projects List Page | `src/app/profile/[username]/projects/page.tsx` |
| Project View Page | `src/app/profile/[username]/projects/[projectId]/page.tsx` |
| Project Edit Page | `src/app/profile/[username]/projects/[projectId]/edit/page.tsx` |
| API - Projects CRUD | `src/app/api/users/[username]/projects/route.ts` |
| API - Project Detail | `src/app/api/users/[username]/projects/[projectId]/route.ts` |
| API - Slides | `src/app/api/users/[username]/projects/[projectId]/slides/` |
| API - Links | `src/app/api/users/[username]/projects/[projectId]/links/` |
| API - Text Sections | `src/app/api/users/[username]/projects/[projectId]/text_sections/` |
| Client API | `src/api/projects.ts` |
| ProjectCard Component | `src/components/projects/ProjectCard.tsx` |

### Startups
| Component | Path |
|---|---|
| Startup Directory | `src/app/startups/page.tsx` |
| Startup Create Wizard | `src/app/startups/create/page.tsx` |
| Startup Detail Page | `src/app/startups/[id]/page.tsx` |
| Startup Edit Page | `src/app/startups/[id]/edit/page.tsx` |
| Wizard Component | `src/components/startups/StartupCreateWizard.tsx` |
| Step Components | `src/components/startups/Step1Identity.tsx` ... `Step8Visibility.tsx` |
| Profile View Component | `src/components/startups/StartupProfileView.tsx` |
| API - Startups CRUD | `src/app/api/startups/route.ts` |
| API - Startup Detail | `src/app/api/startups/[id]/route.ts` |
| API - Founders | `src/app/api/startups/[id]/founders/route.ts` |
| API - Funding | `src/app/api/startups/[id]/funding/route.ts` |
| API - Views | `src/app/api/startups/[id]/view/route.ts` |
| API - Bookmarks | `src/app/api/startups/[id]/bookmark/route.ts` |
| Client API | `src/api/startups.ts` |
| Investor Deals API | `src/api/investor-deals.ts` |

---

# Approaches for Org Projects

The goal: Org projects need **startup_profiles' discovery + team + stage** combined with **projects' rich content (slides, sections, links)** — minus the funding/legal/investor machinery.

Below are five approaches, each analyzed in depth.

---

## Approach A: Extend the Projects Table

Add org-level capabilities directly to the existing `projects` table. Projects gain an optional `scope` field and new relational tables for team, bookmarks, and views.

### Schema Changes

```sql
-- Add columns to projects
ALTER TABLE projects
  ADD COLUMN scope          TEXT DEFAULT 'personal' CHECK (scope IN ('personal', 'org')),
  ADD COLUMN stage          TEXT CHECK (stage IN ('ideation', 'mvp', 'scaling', 'expansion', 'maturity')),
  ADD COLUMN description    TEXT,
  ADD COLUMN logo_url_new   TEXT,  -- already has logo_url, may need to repurpose
  ADD COLUMN banner_url     TEXT,
  ADD COLUMN website        TEXT,
  ADD COLUMN location_city  TEXT,
  ADD COLUMN location_country TEXT,
  ADD COLUMN keywords       TEXT[] DEFAULT '{}',
  ADD COLUMN is_published   BOOLEAN DEFAULT true,
  ADD COLUMN elevator_pitch TEXT,
  ADD COLUMN parent_org_id  UUID REFERENCES users(id);  -- for incubator/e-cell parenting

-- New: team members for org projects
CREATE TABLE project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  role          TEXT,
  email         TEXT,
  ments_username TEXT,
  avatar_url    TEXT,
  status        TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- New: bookmarks for org projects
CREATE TABLE project_bookmarks (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);

-- New: view tracking for org projects
CREATE TABLE project_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  viewer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ DEFAULT now()
);

-- New: incubator/award affiliations for org projects
CREATE TABLE project_incubators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID REFERENCES projects(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  year         INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### UX Changes

```
Personal projects: everything stays the same.
  /profile/[username]/projects/[id] — no change.

Org projects: new creation flow + discovery page.
  /projects (new discovery page, like /startups but for org projects)
    └─ Filter by stage, sort by hot/new
    └─ Ranked cards with upvotes
  /projects/[id] (public detail page, not under /profile)
    └─ Banner + logo + stage badge
    └─ Team section
    └─ Slides gallery + text sections (reuse existing)
    └─ Bookmarks, view count
  /projects/create (creation wizard, lighter than startup's 8 steps)

Profile page:
  └─ Personal projects: shown as today (up to 4 cards)
  └─ Org projects: shown separately or mixed in, badge distinguishes them
```

### API Changes

```
Existing project endpoints stay — add scope filter:
  GET /api/users/[username]/projects?scope=personal  (profile view)
  GET /api/projects?scope=org                        (discovery page, new)

New endpoints:
  GET/POST   /api/projects/[id]/members
  POST/DEL   /api/projects/[id]/bookmark
  POST       /api/projects/[id]/view
```

### Pros

- **Minimal new infra.** Projects already have slides, links, text sections — the rich content layer is done.
- **Single `projects` table.** No data duplication. Personal and org projects share the same base.
- **Clean URL model.** `/profile/[username]/projects/[id]` for personal, `/projects/[id]` for org. Same entity, different access patterns.
- **Slides + text sections work for both.** A Formula SAE team can showcase their car build with slides and write-ups. A hackathon project can show screenshots. Already built.
- **Easy migration.** Existing projects untouched (`scope` defaults to `'personal'`, new columns nullable). No data loss.

### Cons

- **Projects table gets wide.** 15+ new nullable columns that only matter when `scope = 'org'`. Personal projects carry dead weight.
- **Two discovery pages.** `/startups` for startups, `/projects` for org projects. Users must choose where to list. Similar but separate ranking/filtering logic to maintain.
- **Upgrade path to startup still broken.** If an org project needs funding later, there's no migration to `startup_profiles`. You'd need a "convert to startup" action that copies data across tables and deletes the project.
- **Team table duplication.** `project_members` is structurally identical to `startup_founders`. Two tables doing the same thing.
- **Bookmark/view table duplication.** `project_bookmarks` mirrors `startup_bookmarks`. `project_views` mirrors `startup_profile_views`.

### Edge Cases Handled

- Avishkar Hyperloop: Yes — create as org project with team. TuTr exists separately as startup. No linking though.
- Formula SAE: Yes — perpetual org project, no funding fields to confuse users.
- Hackathon → Startup: Partial — would need manual "convert to startup" action.
- E-Cell parenting: Yes — `parent_org_id` lets an E-Cell profile show its org projects.
- Diaspora reversal: No — still can't "downgrade" a startup to a project.

---

## Approach B: Extend the Startups Table

Add rich content (slides, text sections, links) to `startup_profiles` and add a `type` field to distinguish org projects from startups. Org projects are startups with funding/legal features hidden.

### Schema Changes

```sql
-- Add type to startup_profiles
ALTER TABLE startup_profiles
  ADD COLUMN entity_type TEXT DEFAULT 'startup' CHECK (entity_type IN ('org_project', 'startup'));

-- Make startup-only fields nullable (they already are, but relax NOT NULL on email/phone)
ALTER TABLE startup_profiles
  ALTER COLUMN startup_email DROP NOT NULL,
  ALTER COLUMN startup_phone DROP NOT NULL,
  ALTER COLUMN is_actively_raising SET DEFAULT false;

-- Reuse project's content tables but linked to startup_profiles
CREATE TABLE startup_slides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id   UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  slide_url    TEXT NOT NULL,
  caption      TEXT,
  slide_number INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  icon_name     TEXT,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_text_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  heading       TEXT NOT NULL,
  content       TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Add parent org support
ALTER TABLE startup_profiles
  ADD COLUMN parent_org_id UUID REFERENCES users(id);
```

### UX Changes

```
Startup creation wizard: add Step 0 — "What are you creating?"
  └─ Option A: "Org Project" (team project, open source, club, etc.)
  └─ Option B: "Startup" (company raising funding)
  └─ This sets entity_type and controls which steps appear.

Org Project creation (entity_type = 'org_project'):
  Step 1: Identity (name, stage, location — NO legal status, CIN, email/phone)
  Step 2: Description + Team
  Step 3: Branding (logo + banner)
  Step 4: Positioning (categories, website, tags)
  Step 5: Media (slides, text sections, links — NEW)
  Step 6: Visibility

Startup creation: unchanged (all 8 steps).

/startups directory:
  └─ Shows both org projects and startups
  └─ Filter pill: "All | Org Projects | Startups"
  └─ Or: separate tabs

/startups/[id] detail page:
  └─ If org_project: hide funding section, legal info, investor pipeline
  └─ Show slides gallery + text sections (new)
  └─ Show team, bookmarks, stage — same as startup

Upgrade flow:
  └─ Org project owner sees "Convert to Startup" button
  └─ Fills in missing startup fields (legal, email, funding)
  └─ entity_type flips to 'startup'. Same row, same URL, no data loss.
```

### API Changes

```
Existing startup endpoints gain type filter:
  GET /api/startups?type=org_project
  GET /api/startups?type=startup

New endpoints for rich content:
  GET/POST   /api/startups/[id]/slides
  PUT/DEL    /api/startups/[id]/slides/[slideId]
  GET/POST   /api/startups/[id]/links
  PUT/DEL    /api/startups/[id]/links/[linkId]
  GET/POST   /api/startups/[id]/text_sections
  PUT/DEL    /api/startups/[id]/text_sections/[sectionId]
```

### Pros

- **No table duplication.** Team = `startup_founders`. Bookmarks = `startup_bookmarks`. Views = `startup_profile_views`. All reused.
- **Clean upgrade path.** Org project → startup is a field flip on the same row. No data migration, no URL change, no content loss.
- **Single discovery page.** `/startups` shows both, filterable. One ranking algorithm, one caching strategy.
- **Investor pipeline works for both** (or just hidden for org projects). An investor could track an interesting org project that might become a startup.
- **E-Cell parenting works** via `parent_org_id`. E-Cell sees all its org projects and startups in one query.
- **Diaspora reversal works.** Flip `entity_type` back to `org_project`. Funding data stays but is hidden.

### Cons

- **startup_profiles table is already massive** (40+ columns). Adding `entity_type` makes it wider conceptually. Org projects carry ~15 nullable funding/legal columns they'll never use.
- **Naming confusion.** The table is called `startup_profiles` but now holds non-startups. URL is `/startups/[id]` for something that isn't a startup. Need UI renaming.
- **Creation wizard complexity.** Two branching flows in one wizard. Step components need conditional rendering based on `entity_type`.
- **Existing startup UX assumptions break.** Stage filter, "Raising" badges, investor Deal Flow — all assume startups. Need guards everywhere: `if (entity_type === 'startup')`.
- **Rich content tables are new.** `startup_slides`, `startup_links`, `startup_text_sections` — structurally identical to the project versions. 3 new tables + 6 new API endpoints.
- **Personal projects are completely separate.** No relationship between a user's personal project and their org project/startup. If someone has a personal project AND an org project about the same thing, they're unlinked.

### Edge Cases Handled

- Avishkar + TuTr: Yes — both in `startup_profiles` as different rows. Could add `related_entity_id` to link them.
- Formula SAE: Yes — `entity_type = 'org_project'`, funding fields hidden.
- Hackathon → Startup: Yes — flip `entity_type`. Same row.
- E-Cell parenting: Yes — `parent_org_id`.
- Diaspora reversal: Yes — flip `entity_type` back.
- Shared team: Yes — `startup_founders` handles both.

---

## Approach C: New Unified "Ventures" Table

Replace both `projects` and `startup_profiles` with a single `ventures` table. Everything — personal projects, org projects, startups — is a venture at a different tier.

### Schema Changes

```sql
CREATE TABLE ventures (
  -- Core identity (all tiers)
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES auth.users(id) NOT NULL,
  tier            TEXT NOT NULL CHECK (tier IN ('personal', 'org', 'startup')),
  title           TEXT NOT NULL,      -- was brand_name for startups, title for projects
  tagline         TEXT,               -- was tagline for projects, elevator_pitch for startups
  description     TEXT,
  category        TEXT,               -- single category for personal, ignored for org/startup
  categories      TEXT[] DEFAULT '{}', -- multi-category for org/startup
  keywords        TEXT[] DEFAULT '{}',
  url             TEXT,               -- proof link (personal) or website (org/startup)
  cover_url       TEXT,
  logo_url        TEXT,
  banner_url      TEXT,

  -- Org + Startup tier
  stage           TEXT CHECK (stage IS NULL OR stage IN ('ideation', 'mvp', 'scaling', 'expansion', 'maturity')),
  team_size       TEXT,
  key_strengths   TEXT,
  target_audience TEXT,
  business_model  TEXT,
  city            TEXT,
  country         TEXT,
  state           TEXT,
  pitch_deck_url  TEXT,
  parent_org_id   UUID REFERENCES users(id),

  -- Startup tier only
  registered_name TEXT,
  legal_status    TEXT CHECK (legal_status IS NULL OR legal_status IN ('llp', 'pvt_ltd', 'sole_proprietorship', 'not_registered')),
  cin             TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  founded_date    TEXT,
  address_line1   TEXT,
  address_line2   TEXT,
  revenue_amount  TEXT,
  revenue_currency TEXT DEFAULT 'USD',
  revenue_growth  TEXT,
  traction_metrics TEXT,
  total_raised    TEXT,
  investor_count  INT,
  is_actively_raising BOOLEAN DEFAULT false,
  raise_target    TEXT,
  equity_offered  TEXT,
  min_ticket_size TEXT,
  funding_stage   TEXT CHECK (funding_stage IS NULL OR funding_stage IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'bridge')),
  sector          TEXT,

  -- Visibility & status
  visibility      TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted', 'investors_only')),
  is_published    BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  sort_order      INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Unified content tables (all tiers)
CREATE TABLE venture_slides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id   UUID REFERENCES ventures(id) ON DELETE CASCADE,
  slide_url    TEXT NOT NULL,
  caption      TEXT,
  slide_number INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venture_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id    UUID REFERENCES ventures(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  icon_name     TEXT,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venture_text_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id    UUID REFERENCES ventures(id) ON DELETE CASCADE,
  heading       TEXT NOT NULL,
  content       TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Unified team (org + startup tiers)
CREATE TABLE venture_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id      UUID REFERENCES ventures(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  role            TEXT,
  email           TEXT,
  ments_username  TEXT,
  avatar_url      TEXT,
  status          TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  display_order   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Unified social proof
CREATE TABLE venture_bookmarks (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, venture_id)
);

CREATE TABLE venture_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  viewer_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at  TIMESTAMPTZ DEFAULT now()
);

-- Startup-tier only tables
CREATE TABLE venture_funding_rounds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id  UUID REFERENCES ventures(id) ON DELETE CASCADE,
  investor    TEXT,
  amount      TEXT,
  round_type  TEXT CHECK (round_type IN ('pre_seed', 'seed', 'series_a', 'series_b', 'series_c', 'other')),
  round_date  TEXT,
  is_public   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venture_incubators (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id   UUID REFERENCES ventures(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  year         INT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE venture_awards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venture_id UUID REFERENCES ventures(id) ON DELETE CASCADE,
  award_name TEXT NOT NULL,
  year       INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Update investor_deals to reference ventures
ALTER TABLE investor_deals
  RENAME COLUMN startup_id TO venture_id;
ALTER TABLE investor_deals
  ADD CONSTRAINT fk_investor_deals_venture FOREIGN KEY (venture_id) REFERENCES ventures(id);
```

### UX Changes

```
Everything consolidates:

/ventures (discovery page — replaces /startups)
  └─ Tab bar: All | Org Projects | Startups
  └─ Or filter pills alongside stage filter
  └─ Personal projects NOT shown here (they stay on profiles)

/ventures/create
  └─ Step 0: "What are you building?"
     - Org Project → lighter flow (5 steps)
     - Startup → full flow (8 steps)

/ventures/[id] (detail page)
  └─ Adaptive layout based on tier:
     - Always: cover/banner, title, description, team, slides, links, text sections
     - Org+Startup: stage badge, categories, location
     - Startup only: funding, legal, investor pipeline

/profile/[username]
  └─ Personal projects: shown as cards (up to 4), links to /profile/[username]/projects
  └─ Org projects + Startups: shown via show_ventures toggle

Tier transitions:
  └─ Personal → Org: "Make collaborative" action. Adds to discovery, enables team.
  └─ Org → Startup: "Register as startup" action. Unlocks funding/legal fields.
  └─ Startup → Org: "Remove startup status" action. Hides funding/legal, keeps everything else.
  └─ Any direction. Same row, same URL.
```

### Migration Effort

```
HIGH. Requires:
  1. Create ventures table + all sub-tables
  2. Migrate all rows from projects → ventures (tier = 'personal')
  3. Migrate all rows from startup_profiles → ventures (tier = 'startup')
  4. Migrate project_slides → venture_slides
  5. Migrate project_links → venture_links
  6. Migrate project_text_sections → venture_text_sections
  7. Migrate startup_founders → venture_members
  8. Migrate startup_bookmarks → venture_bookmarks
  9. Migrate startup_profile_views → venture_views
  10. Migrate startup_funding_rounds → venture_funding_rounds
  11. Migrate startup_incubators → venture_incubators
  12. Migrate startup_awards → venture_awards
  13. Update investor_deals FK
  14. Rewrite ALL API routes (projects + startups → ventures)
  15. Rewrite ALL pages (projects + startups → ventures)
  16. Rewrite client API functions
  17. Update feed engine references
  18. Drop old tables

  Estimated: 30+ files changed, every startup and project page rewritten.
```

### Pros

- **Perfectly unified model.** One entity, one table, three tiers. No duplication anywhere.
- **All tier transitions work.** Personal ↔ Org ↔ Startup. Same row, same URL, no data loss.
- **Single discovery page.** One ranking algorithm, one caching layer.
- **Clean for E-Cells/Incubators.** `parent_org_id` on the unified table. One query shows everything under an org.
- **Future-proof.** New tiers (e.g., `non_profit`, `research_lab`) are a CHECK constraint update.
- **Content model is universal.** Slides, text sections, and links available at every tier. A startup can have a case study. A personal project can have one too.

### Cons

- **Massive migration.** Every file that touches projects or startups must be rewritten. High risk of regression.
- **Giant table.** `ventures` has 40+ columns. Personal projects use maybe 8 of them. The rest are NULL.
- **URL breaking change.** `/startups/[id]` → `/ventures/[id]`. Existing links/bookmarks break unless redirects are maintained.
- **Over-engineered for current scale.** The app has a small user base. This is a rewrite-level change for a problem that affects a future feature (org projects) that doesn't exist yet.
- **Naming.** "Ventures" is a loaded term. May not resonate with a designer showcasing a Figma project.

### Edge Cases Handled

- ALL of them. Every edge case from the research is cleanly handled by tier transitions on a single row.

---

## Approach D: Polymorphic Feature Tables

Keep `projects` and `startup_profiles` as separate tables. Create shared feature tables (team, bookmarks, views) that can attach to either entity via a polymorphic `entity_type + entity_id` pattern.

### Schema Changes

```sql
-- Shared team table (replaces startup_founders for new entries, works for projects too)
CREATE TABLE entity_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('project', 'startup')),
  entity_id     UUID NOT NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  role          TEXT,
  email         TEXT,
  ments_username TEXT,
  avatar_url    TEXT,
  status        TEXT DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'declined')),
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_entity_members_lookup ON entity_members(entity_type, entity_id);

-- Shared bookmarks
CREATE TABLE entity_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'startup')),
  entity_id   UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, entity_type, entity_id)
);

-- Shared views
CREATE TABLE entity_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('project', 'startup')),
  entity_id   UUID NOT NULL,
  viewer_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ DEFAULT now()
);

-- Add scope + stage to projects for org projects
ALTER TABLE projects
  ADD COLUMN scope TEXT DEFAULT 'personal' CHECK (scope IN ('personal', 'org')),
  ADD COLUMN stage TEXT CHECK (stage IS NULL OR stage IN ('ideation', 'mvp', 'scaling', 'expansion', 'maturity'));

-- Add rich content to startups
CREATE TABLE startup_slides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id   UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  slide_url    TEXT NOT NULL,
  caption      TEXT,
  slide_number INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  icon_name     TEXT,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_text_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  heading       TEXT NOT NULL,
  content       TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### UX Changes

```
Two separate discovery pages remain:
  /startups — startups (unchanged)
  /projects — org projects (new)

Personal projects: stay on profile, unchanged.
Org projects: get team, bookmarks, views, stage via shared tables.
Startups: gain slides, text sections, links.

No tier transition. Org project and startup remain separate entities.
To "upgrade" an org project to a startup: manual recreation.
```

### Pros

- **Minimal disruption.** Both tables stay. Existing code mostly untouched.
- **No data migration.** New tables are additive.
- **Shared features without shared identity.** Team, bookmarks, views are DRY across both entity types.
- **Startups get rich content.** Slides and text sections benefit startups independently of the org project question.

### Cons

- **No foreign key integrity.** `entity_id` can't have a FK constraint because it points to two different tables. Must enforce at the application level. Data integrity risk.
- **Complex queries.** Joins require `WHERE entity_type = 'project' AND entity_id = ?`. No native FK joins. Supabase PostgREST doesn't handle polymorphic joins well.
- **No upgrade path.** Org project → startup is still a manual recreation across tables. Content doesn't transfer.
- **Two discovery pages.** Same duplication problem as Approach A.
- **RLS complexity.** Policies on polymorphic tables need to check both `projects` and `startup_profiles` for ownership. Harder to write, harder to audit.
- **Still duplicates content tables.** `project_slides` + `startup_slides` are structurally identical but separate.

### Edge Cases Handled

- Avishkar + TuTr: Partial — separate entities, shared team via polymorphic table, but no explicit link between them.
- Formula SAE: Yes — org project with team via entity_members.
- Hackathon → Startup: No — manual recreation.
- E-Cell parenting: Requires `parent_org_id` on both tables separately.
- Diaspora reversal: No.

---

## Approach E: Extend Startups + Keep Projects Separate (Pragmatic Hybrid)

Keep personal projects exactly as they are. Extend `startup_profiles` to support org projects by adding `entity_type` and rich content tables. Don't try to unify the two worlds — just make startups flexible enough to also be org projects.

### Schema Changes

```sql
-- Minimal changes to startup_profiles
ALTER TABLE startup_profiles
  ADD COLUMN entity_type TEXT DEFAULT 'startup' CHECK (entity_type IN ('org_project', 'startup')),
  ADD COLUMN parent_org_id UUID REFERENCES users(id);

-- Relax startup-only required fields
ALTER TABLE startup_profiles
  ALTER COLUMN startup_email DROP NOT NULL,
  ALTER COLUMN startup_phone DROP NOT NULL;

-- Rich content for startups/org projects
CREATE TABLE startup_slides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id   UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  slide_url    TEXT NOT NULL,
  caption      TEXT,
  slide_number INT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_links (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  url           TEXT NOT NULL,
  icon_name     TEXT,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE startup_text_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id    UUID REFERENCES startup_profiles(id) ON DELETE CASCADE,
  heading       TEXT NOT NULL,
  content       TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

### UX Changes

```
Personal projects: ZERO changes. Stay on profile, same tables, same API.

/startups directory:
  └─ Rename to /ventures or /directory (UI only, URL can stay /startups)
  └─ Add filter: "All | Projects | Startups"
  └─ Org projects show without funding badges/investor pipeline

/startups/create:
  └─ Step 0: "Org Project" or "Startup"
  └─ Org Project flow (5 steps):
     1. Name, stage, location (no legal/CIN/email/phone)
     2. Description + Team
     3. Branding (logo + banner)
     4. Content (slides, text sections, links — new)
     5. Visibility
  └─ Startup flow: unchanged (8 steps), but gains optional slides/sections

/startups/[id]:
  └─ Conditionally renders based on entity_type
  └─ Org project: hides funding, legal, investor pipeline sections
  └─ Both: show slides gallery, text sections, links (new)

Tier transition:
  └─ "Upgrade to Startup" button on org project → fill in legal/funding fields → entity_type flips
  └─ "Downgrade to Org Project" on startup → hides funding/legal → entity_type flips back
  └─ Same row, same URL, same team, same content. No data loss.
```

### API Changes

```
Existing startup routes gain type filter:
  GET /api/startups?type=org_project|startup

New endpoints (6):
  GET/POST   /api/startups/[id]/slides
  PUT/DEL    /api/startups/[id]/slides/[slideId]
  GET/POST   /api/startups/[id]/links
  PUT/DEL    /api/startups/[id]/links/[linkId]
  GET/POST   /api/startups/[id]/text_sections
  PUT/DEL    /api/startups/[id]/text_sections/[sectionId]

Modified endpoints:
  POST /api/startups — accept entity_type, relax validation for org_project
  PUT  /api/startups/[id] — allow entity_type change (upgrade/downgrade)
```

### Migration Effort

```
LOW-MEDIUM:
  1. One ALTER TABLE on startup_profiles (2 columns)
  2. Three new content tables (slides, links, text_sections)
  3. Modify StartupCreateWizard to branch on entity_type
  4. Modify /startups/[id] page to conditionally render sections
  5. Modify /startups directory to filter by entity_type
  6. Add 6 new API routes for rich content
  7. Update client API (src/api/startups.ts) with new functions

  ~15 files changed. No data migration. No breaking changes to existing startups.
```

### Pros

- **Personal projects untouched.** Zero risk of regression on the portfolio feature.
- **Reuses all startup infra.** Team, bookmarks, views, discovery, caching, investor_deals — all work for org projects for free.
- **Clean upgrade/downgrade.** Org ↔ Startup is a field flip. Same row, same URL, same content.
- **Single discovery page.** One ranking algo. One cache layer.
- **Moderate effort.** No data migration. Additive schema changes. ~15 files touched.
- **Startups also benefit.** Slides and text sections make startup pages richer — a startup can now have a visual showcase and long-form sections.
- **FK integrity preserved.** No polymorphic hacks. Everything has proper foreign keys.
- **E-Cell parenting works.** `parent_org_id` on the unified table.

### Cons

- **Naming debt.** Table is `startup_profiles`, URL is `/startups/[id]`, but entity might be an org project. Need UI-level renaming without breaking API/DB names.
- **startup_profiles still wide.** Org projects carry nullable funding/legal columns (~15 columns they'll never use.
- **Personal projects are an island.** A user's personal project and their org project about the same thing have no connection. If they want to "upgrade" a personal project to an org project, they must recreate it in the startup system from scratch.
- **Wizard branching.** The creation wizard needs conditional steps. More UI complexity in an already 8-step flow.

### Edge Cases Handled

- Avishkar + TuTr: Yes — both in `startup_profiles`, different `entity_type`. Could add `related_entity_id` to link them explicitly.
- Formula SAE: Yes — `entity_type = 'org_project'`, no funding fields shown.
- Hackathon → Startup: Yes — if created as org_project, flip to startup. If it was a personal project first, manual recreation needed.
- E-Cell parenting: Yes — `parent_org_id`.
- Diaspora reversal: Yes — flip `entity_type` back.
- Shared team: Yes — `startup_founders` handles both.
- Sponsored but not raising: Yes — `is_actively_raising = false`, no fundraising UI shown.

---

## Decision Matrix

| Criteria | A: Extend Projects | B: Extend Startups | C: Unified Ventures | D: Polymorphic | E: Pragmatic Hybrid |
|---|---|---|---|---|---|
| **Migration effort** | Low | Medium | Very High | Medium | Low-Medium |
| **Files changed** | ~20 | ~20 | ~30+ | ~25 | ~15 |
| **Data migration needed** | No | No | Yes (all rows) | No | No |
| **URL breaking changes** | No | No | Yes | No | No |
| **Upgrade path (org→startup)** | Manual copy | Field flip | Field flip | Manual copy | Field flip |
| **Downgrade path** | No | Field flip | Field flip | No | Field flip |
| **Table duplication** | High (new team/bookmark/view tables) | Low (3 content tables) | None | Medium (polymorphic + content) | Low (3 content tables) |
| **FK integrity** | Yes | Yes | Yes | No (polymorphic) | Yes |
| **Single discovery page** | No (2 pages) | Yes | Yes | No (2 pages) | Yes |
| **Personal projects affected** | Yes (table changes) | No | Yes (migrated) | Yes (new columns) | No |
| **Startups affected** | No | Yes (type field + UI guards) | Yes (migrated) | No | Yes (type field + UI guards) |
| **PostgREST/Supabase friendly** | Yes | Yes | Yes | Poor | Yes |
| **Future tier extensibility** | Low | Medium | High | Low | Medium |
| **Avishkar fork case** | Partial | Yes | Yes | Partial | Yes |
| **Formula SAE perpetual** | Yes | Yes | Yes | Yes | Yes |
| **Diaspora reversal** | No | Yes | Yes | No | Yes |
| **E-Cell parenting** | Yes | Yes | Yes | Partial | Yes |

---

## Decision: Approach E (Pragmatic Hybrid)

**Chosen: 2025-03-10**

Extend `startup_profiles` with `entity_type` + rich content tables. Keep personal projects untouched.

### Why E over others
- **B and E are nearly identical** — E explicitly scopes the change: don't touch personal projects. Zero regression risk on portfolio feature.
- **C (Unified Ventures) is the "correct" architecture but wrong timing.** 30+ file rewrite for a feature that doesn't exist yet. Revisit in 6-12 months if the two-table model becomes painful.
- **A and D lack upgrade/downgrade paths.** The field-flip from org_project ↔ startup on the same row is the killer feature.
- **Naming debt is cosmetic, not structural.** UI says "Ventures" or "Directory"; DB stays `startup_profiles`; URL stays `/startups/[id]`. Cosmetic renames are cheap. Table renames are not.

### Implementation summary
1. Migration: `ALTER TABLE startup_profiles` add `entity_type`, `parent_org_id`; relax `startup_email`/`startup_phone` NOT NULL
2. 3 new tables: `startup_slides`, `startup_links`, `startup_text_sections`
3. 6 new API routes for rich content CRUD
4. Modify `StartupCreateWizard` — Step 0 branches on entity_type
5. Modify `/startups/[id]` detail page — conditional rendering
6. Modify `/startups` directory — entity_type filter
7. ~15 files changed, no data migration, no breaking changes

---

# Approach E — Detailed UX Flow

## 1. Discovery Page (`/startups`)

**Current:** Only startups. Tabs: Directory | My Startup | Deal Flow.

**New:**

```
┌─────────────────────────────────────────────────────┐
│  Directory                                           │
│                                                      │
│  [All]  [Projects]  [Startups]    ← entity_type      │
│                                     filter pills     │
│  [Hot]  [New]                     ← sort (unchanged) │
│  [All] [Ideation] [MVP] [Scaling] ← stage filter     │
│                                                      │
│  Podium: Top 3 (mix of both types)                   │
│                                                      │
│  4. ┌──────────────────────────────────────────┐     │
│     │ [logo] Avishkar Hyperloop                │     │
│     │ [ORG PROJECT] [MVP]           ^ 42       │     │
│     │ Student team building India's first...   │     │
│     │ Chennai, India                           │     │
│     └──────────────────────────────────────────┘     │
│                                                      │
│  5. ┌──────────────────────────────────────────┐     │
│     │ [logo] TuTr Hyperloop                    │     │
│     │ [STARTUP] [Scaling] [Raising]     ^ 38   │     │
│     │ Cost-effective hyperloop for cargo...    │     │
│     │ Chennai, India                           │     │
│     └──────────────────────────────────────────┘     │
│                                                      │
│  Tabs: [Directory]  [My Ventures]  [Deal Flow]       │
└─────────────────────────────────────────────────────┘
```

**Changes from current:**
- Entity type filter pills: All | Projects | Startups
- Cards show badge: `ORG PROJECT` (muted) or `STARTUP` (green)
- Org project cards never show "Raising" badge
- "My Startup" tab renamed "My Ventures" (shows both types)
- Deal Flow tab unchanged — only shows `entity_type = 'startup'`
- `+ List` button goes to type picker before wizard

**Query:**
```sql
SELECT * FROM startup_profiles
  WHERE is_published = true
  AND entity_type IN ('org_project', 'startup')  -- or filter to one
  AND stage = ?
  ORDER BY bookmark_count DESC
```

---

## 2. Type Picker (before creation wizard)

User clicks `+ List`. Before the wizard, they choose:

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  What are you building?                              │
│                                                      │
│  ┌───────────────────────┐  ┌──────────────────────┐│
│  │                       │  │                      ││
│  │   Org Project         │  │   Startup            ││
│  │                       │  │                      ││
│  │   Team project,       │  │   Company seeking    ││
│  │   open source,        │  │   funding, with      ││
│  │   college club,       │  │   legal entity,      ││
│  │   hackathon build     │  │   investors,         ││
│  │                       │  │   revenue tracking   ││
│  │   Team + Discovery    │  │                      ││
│  │   No funding setup    │  │   Everything above   ││
│  │                       │  │   plus fundraising   ││
│  │  [Select]             │  │  [Select]            ││
│  └───────────────────────┘  └──────────────────────┘│
│                                                      │
│  You can upgrade an Org Project to a Startup later.  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

Sets `entity_type` and routes to the appropriate wizard flow. This is a new page or modal — not a wizard step.

---

## 3a. Org Project Creation Wizard (5 steps)

Trimmed version of the existing 8-step startup wizard. Same `StartupCreateWizard` component with steps conditionally included based on `entityType` prop.

### Step 1: Identity (trimmed)

```
┌─────────────────────────────────────────────────────┐
│  Step 1 of 5 — Identity                             │
│                                                      │
│  Project Name *              [Avishkar Hyperloop   ] │
│  Stage *                     [MVP            v     ] │
│  Country                     [India          v     ] │
│  State                       [Tamil Nadu     v     ] │
│  City                        [Chennai              ] │
│  Business Model              [                     ] │
│                                                      │
│  REMOVED vs startup wizard:                          │
│    Legal Status, CIN, Registered Name,               │
│    Startup Email, Startup Phone,                     │
│    Founded Date, Address lines                       │
│                                                      │
│                          [Back]  [Next]               │
└─────────────────────────────────────────────────────┘
```

DB: `brand_name`, `stage`, `country`, `state`, `city`, `business_model`. Legal/contact fields stay NULL.

### Step 2: Description + Team (unchanged)

Identical to current Step 2. Description textarea + founder/member management with Ments user search. Same `startup_founders` table.

### Step 3: Branding (unchanged)

Identical to current Step 3. Logo + banner upload. Same storage paths.

### Step 4: Showcase (NEW — merged positioning + content)

Combines old Step 4 (categories/website/tags) with new rich content:

```
┌─────────────────────────────────────────────────────┐
│  Step 4 of 5 — Showcase                             │
│                                                      │
│  Categories        [AI / ML x] [Hardware x] [+ Add] │
│  Website           [https://avishkarhyperloop.com ] │
│  Team Size         [21-50                    v    ] │
│  Tags              [hyperloop x] [iitm x] [+ Add]  │
│                                                      │
│  -- Project Links ---                                │
│  [+ Add Link]                                       │
│  | GitHub Repo   github.com/avishkar/...   [trash] |│
│  | Research Paper arxiv.org/abs/...        [trash] |│
│                                                      │
│  -- Slides / Gallery ---                             │
│  [+ Upload Images]                                  │
│  [img1] [img2] [img3] [img4]  (draggable)          │
│                                                      │
│  -- About / Write-up ---                             │
│  [+ Add Section]                                    │
│  | "The Problem"                                   |│
│  | India's freight corridors are clogged...        |│
│  |                                    [Edit][trash]|│
│  | "Our Approach"                                  |│
│  | Maglev propulsion at 1/10th the cost...        |│
│  |                                    [Edit][trash]|│
│                                                      │
│                          [Back]  [Next]               │
└─────────────────────────────────────────────────────┘
```

DB mapping:
- Categories, website, team_size, keywords -> `startup_profiles` (existing)
- Links -> `startup_links` (NEW table)
- Slides -> `startup_slides` (NEW table)
- Text sections -> `startup_text_sections` (NEW table)

### Step 5: Visibility

Same as current Step 8, minus `investors_only` for org projects:

```
┌─────────────────────────────────────────────────────┐
│  Step 5 of 5 — Visibility                           │
│                                                      │
│  Who can see this?                                   │
│                                                      │
│  o Public — anyone can find and view this           │
│  o Private — only you and team members              │
│  o Unlisted — accessible via link, not in directory │
│                                                      │
│  "Investors Only" is available for Startups.        │
│  You can upgrade to Startup later.                  │
│                                                      │
│  [x] I confirm this information is accurate          │
│                                                      │
│                          [Back]  [Publish]            │
└─────────────────────────────────────────────────────┘
```

### On Submit

```
POST /api/startups
Body: {
  entity_type: 'org_project',
  brand_name: 'Avishkar Hyperloop',
  stage: 'mvp',
  city: 'Chennai',
  country: 'India',
  // startup_email: null (not sent)
  // startup_phone: null (not sent)
  // is_actively_raising: false (default)
  visibility: 'public',
  is_published: true
}
-> Row in startup_profiles (entity_type = 'org_project')
-> Rows in startup_founders
-> Rows in startup_slides
-> Rows in startup_links
-> Rows in startup_text_sections
-> Redirect to /startups/[id]
```

API validation: if `entity_type = 'org_project'`, skip required checks on `startup_email`, `startup_phone`, `legal_status`.

---

## 3b. Startup Creation Wizard (8 steps, enhanced)

Existing 8 steps unchanged. Startups optionally gain a Showcase section:

```
Step 1: Identity (unchanged — includes legal, CIN, email, phone)
Step 2: Description + Team (unchanged)
Step 3: Branding (unchanged)
Step 4: Positioning (unchanged)
Step 5: Competitive Edge (unchanged)
Step 6: Financials (unchanged)
Step 7: Media (unchanged — pitch deck, elevator pitch)
Step 8: Visibility (unchanged — includes investors_only)
```

Startups add slides/links/sections via the edit page after creation (no extra wizard step).

---

## 4. Detail Page (`/startups/[id]`)

Same URL, same component, conditional sections based on `entity_type`.

### Org Project Detail:

```
┌─────────────────────────────────────────────────────┐
│ [Back]                                 [Edit / Del] │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │             BANNER IMAGE                      │   │
│ │    [LOGO]                                     │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│  Avishkar Hyperloop                                  │
│  [ORG PROJECT]  [MVP]                    ^ 42       │
│  Chennai, India                                      │
│                                                      │
│  -- About --                                         │
│  Student team building India's first hyperloop       │
│  test track with indigenous maglev technology.       │
│                                                      │
│  -- Team (76 members) --                             │
│  [Aravind / Lead]  [Priya / Mech]  [Karthik / Elec] │
│                                                      │
│  -- Showcase --                                      │
│  [img1] [img2] [img3] [img4]  (lightbox gallery)    │
│                                                      │
│  -- The Problem --                                   │
│  India's freight corridors are clogged...            │
│                                                      │
│  -- Our Approach --                                  │
│  Maglev propulsion at 1/10th the cost...            │
│                                                      │
│  -- Links --                                         │
│  Website    avishkarhyperloop.com                    │
│  GitHub     github.com/avishkar/firmware             │
│  Paper      arxiv.org/abs/2024.12345                 │
│                                                      │
│  -- Categories & Tags --                             │
│  [AI / ML] [Hardware] [Transportation]               │
│  #hyperloop #iitm #deeptech                          │
│                                                      │
│  HIDDEN (entity_type = 'org_project'):               │
│    Financials, Legal info, Contact (email/phone),    │
│    Fundraising details, Investor pipeline,           │
│    "Raising" badge, Pitch deck                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │  Upgrade to Startup ->                       │   │
│  │  Add funding, legal entity, and investor     │   │
│  │  visibility to this project                  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Startup Detail (enhanced):

Everything that exists today PLUS (if populated):
- Showcase section (slides gallery)
- Text sections (case study / write-up)
- Additional links beyond website

Existing startups with no slides/sections look identical to today.

---

## 5. Edit Page (`/startups/[id]/edit`)

### For Org Projects (4 tabs):

```
┌─────────────────────────────────────────────────────┐
│  Edit: Avishkar Hyperloop              [Save] [Del] │
│  [ORG PROJECT]                                       │
│                                                      │
│  [Info]  [Team]  [Branding]  [Showcase]              │
│                                                      │
│  4 tabs. No Financials, Competitive Edge, or Media.  │
│                                                      │
│  Showcase tab = slides + links + text sections       │
│  (reuses project edit page's managers — same         │
│   components, different data source)                 │
│                                                      │
│  -- Danger Zone --                                   │
│  [Delete Project]                                    │
│  [Upgrade to Startup]                                │
└─────────────────────────────────────────────────────┘
```

### For Startups (8 tabs):

Current 7-tab layout + new Showcase tab:

```
[Info] [Desc] [Branding] [Positioning] [Edge] [Finance] [Media] [Showcase]
                                                                  ^ NEW
```

---

## 6. "My Ventures" Tab

Currently "My Startup" shows one card. Now shows both types:

```
┌─────────────────────────────────────────────────────┐
│  My Ventures                                         │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Avishkar Hyperloop         [ORG PROJECT]     │   │
│  │ Stage: MVP  |  Published  |  Team: 76        │   │
│  │ Views: 234  |  Bookmarks: 42                 │   │
│  │ [View]  [Edit]  [Unpublish]                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ TuTr Hyperloop             [STARTUP]         │   │
│  │ Stage: Scaling  |  Published  |  Raising     │   │
│  │ Views: 891  |  Bookmarks: 38  |  Rounds: 2  │   │
│  │ [View]  [Edit]  [Unpublish]                  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Query already works — fetches `startup_profiles` where user is owner or accepted founder. Returns both `entity_type` values.

---

## 7. Upgrade Flow (Org Project -> Startup)

User clicks "Upgrade to Startup". Modal shows only the missing fields:

```
┌─────────────────────────────────────────────────────┐
│  Upgrade to Startup                                  │
│                                                      │
│  Avishkar Hyperloop will become a Startup.           │
│  Team, content, and bookmarks stay intact.           │
│                                                      │
│  -- Required for Startups --                         │
│                                                      │
│  Legal Status *        [Not Registered      v     ] │
│  Startup Email *       [team@avishkar.com         ] │
│  Startup Phone *       [+91 9876543210            ] │
│                                                      │
│  -- Optional --                                      │
│                                                      │
│  Registered Name       [                          ] │
│  CIN / LLPIN           [                          ] │
│  Actively Raising?     [ ] Yes                      │
│                                                      │
│                    [Cancel]  [Upgrade]                │
└─────────────────────────────────────────────────────┘
```

On submit:
```
PUT /api/startups/[id]
Body: {
  entity_type: 'startup',
  startup_email: 'team@avishkar.com',
  startup_phone: '+91 9876543210',
  legal_status: 'not_registered'
}
```

Same row. Same URL. Same team. Same slides. Same bookmarks. Flips `entity_type`, fills startup-only fields. Detail page immediately shows funding/legal sections.

---

## 8. Downgrade Flow (Startup -> Org Project)

In the startup edit page danger zone:

```
  [Delete Startup]
  [Convert to Org Project]
```

Confirmation dialog:
```
  "This will hide funding details, legal info, and
   investor visibility from your public page.
   Data is preserved — you can upgrade back anytime."

   [Cancel]  [Convert]
```

On submit:
```
PUT /api/startups/[id]
Body: { entity_type: 'org_project' }
```

Funding data stays in DB, just hidden in UI. Upgrade back later and it's all still there.

---

## 9. Profile Page Integration

On `/profile/[username]`, ventures show alongside personal projects:

```
┌─────────────────────────────────────────────────────┐
│  Projects                          [+ Add] [See all]│
│  [card1] [card2] [card3] [card4]                    │
│  (personal projects, unchanged)                     │
│                                                      │
│  Ventures                                  [See all]│
│  ┌─────────────────────┐ ┌─────────────────────┐   │
│  │ Avishkar Hyperloop  │ │ TuTr Hyperloop      │   │
│  │ [ORG PROJECT] [MVP] │ │ [STARTUP] [Scaling] │   │
│  └─────────────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Profile API already fetches startups where user is owner or accepted founder. Now returns both types; frontend renders with appropriate badges.

---

## 10. E-Cell / Incubator View (Future)

When `user_type = 'incubator'` or `'ecell'`:

```sql
SELECT * FROM startup_profiles WHERE parent_org_id = [ecell_user_id]
```

E-Cell profile page shows a "Portfolio" section with all ventures it parents.

---

## File Change Summary

```
UNCHANGED:
  Personal projects (all 4 tables, 12 API routes, all pages)
  Startup bookmarks, views, founders tables
  Investor deals pipeline
  Feed engine

MODIFIED (~10 files):
  startup_profiles table (2 new columns via migration)
  StartupCreateWizard.tsx (step branching on entityType prop)
  Step1Identity.tsx (conditional fields)
  /startups/page.tsx (entity_type filter pills + "My Ventures" tab)
  /startups/[id]/page.tsx (conditional sections + showcase)
  /startups/[id]/edit/page.tsx (tab branching + showcase tab)
  /api/startups/route.ts (type filter param, relaxed validation)
  /api/startups/[id]/route.ts (entity_type in PUT for upgrade/downgrade)
  src/api/startups.ts (new client functions for slides/links/sections)

NEW (~8 files):
  supabase/migrations/015_org_projects.sql
  /api/startups/[id]/slides/route.ts
  /api/startups/[id]/slides/[slideId]/route.ts
  /api/startups/[id]/links/route.ts
  /api/startups/[id]/links/[linkId]/route.ts
  /api/startups/[id]/text_sections/route.ts
  /api/startups/[id]/text_sections/[sectionId]/route.ts
  Showcase step component (or reuse project edit managers)
```

---
---

# IMPLEMENTATION STATUS (Approach E — Executed)

Everything below documents the **actual implemented state** as of 2026-03-11. Approach E was chosen and built. Personal projects remain completely separate and unchanged.

---

## Database Schema

### Migration: `supabase/migrations/015_org_projects.sql`

**Changes to `startup_profiles`:**

```sql
-- New columns
entity_type    TEXT NOT NULL DEFAULT 'startup' CHECK (entity_type IN ('org_project', 'startup'))
parent_org_id  UUID REFERENCES users(id) ON DELETE SET NULL  -- reserved for future org hierarchy

-- Relaxed constraints
startup_email  DROP NOT NULL   -- org projects don't require contact info
startup_phone  DROP NOT NULL

-- Index for filtered directory queries
CREATE INDEX idx_startup_profiles_entity_type ON startup_profiles(entity_type);
```

**3 new showcase tables** (all with `ON DELETE CASCADE` from `startup_profiles`):

```sql
startup_slides
├── id            UUID PK (gen_random_uuid)
├── startup_id    UUID FK → startup_profiles ON DELETE CASCADE
├── slide_url     TEXT NOT NULL
├── caption       TEXT
├── slide_number  INT NOT NULL DEFAULT 0
├── created_at    TIMESTAMPTZ DEFAULT now()
└── INDEX idx_startup_slides_startup_id(startup_id)

startup_links
├── id            UUID PK (gen_random_uuid)
├── startup_id    UUID FK → startup_profiles ON DELETE CASCADE
├── title         TEXT NOT NULL
├── url           TEXT NOT NULL
├── icon_name     TEXT
├── display_order INT NOT NULL DEFAULT 0
├── created_at    TIMESTAMPTZ DEFAULT now()
└── INDEX idx_startup_links_startup_id(startup_id)

startup_text_sections
├── id            UUID PK (gen_random_uuid)
├── startup_id    UUID FK → startup_profiles ON DELETE CASCADE
├── heading       TEXT NOT NULL
├── content       TEXT NOT NULL
├── display_order INT NOT NULL DEFAULT 0
├── created_at    TIMESTAMPTZ DEFAULT now()
└── INDEX idx_startup_text_sections_startup_id(startup_id)
```

**RLS Policies** (same pattern on all 3 tables):

| Operation | Policy |
|---|---|
| SELECT | Anyone can read if `startup_profiles.is_published = true` (subquery check) |
| ALL (insert/update/delete) | Only if `startup_profiles.owner_id = auth.uid()` (subquery check) |

---

## API Layer

### Listing — `GET /api/startups`

- Accepts `?entity_type=org_project` or `?entity_type=startup` query param
- Entity type is included in the cache key (`type=${entity_type || ''}`) — filtered queries cache separately
- Passes `entity_type` to `fetchStartups()` which adds `.eq('entity_type', ...)` when present
- Cache TTL: 60s, prefix-based invalidation (`cacheClearByPrefix('startups')`)

### CRUD — `/api/startups/[id]`

- **GET**: fetches by ID, includes showcase relations via PostgREST join:
  ```
  slides:startup_slides(*), links:startup_links(*), text_sections:startup_text_sections(*)
  ```
- **PUT**: ownership check (`startup_profiles.owner_id = user.id`). The edit page nullifies startup-only fields when `entity_type === 'org_project'`:
  - `legal_status`, `cin`, `business_model` → null
  - `is_actively_raising` → false
  - `raise_target`, `equity_offered`, `min_ticket_size`, `funding_stage`, `sector` → null
- **DELETE**: owner or accepted co-founder can delete. Cascade deletes all showcase rows.
- No entity_type-specific logic in the route itself — same ownership check works for both types

### Showcase Routes (3 routes, identical pattern)

| Route | Body key | Order column |
|---|---|---|
| `/api/startups/[id]/text-sections` | `{ sections: [...] }` | `display_order` |
| `/api/startups/[id]/links` | `{ links: [...] }` | `display_order` |
| `/api/startups/[id]/slides` | `{ slides: [...] }` | `slide_number` |

Each route:
- **GET**: reads all rows for the startup, ordered ascending. Uses `createAdminClient()`.
- **PUT**: delete-and-reinsert pattern:
  1. Verify auth session
  2. Verify ownership (`startup_profiles.owner_id = user.id`)
  3. Delete all existing rows for that `startup_id`
  4. Bulk insert new rows from request body
  5. Return the fresh dataset
- Uses `createAdminClient()` for both read and write (bypasses RLS)

### Client Functions — `src/api/startups.ts`

| Function | Purpose |
|---|---|
| `fetchStartups({ entity_type })` | Filtered listing with optional entity_type |
| `fetchStartupById(id, userId?)` | Single startup with slides, links, text_sections joined |
| `fetchMyVentures(ownerId)` | Returns **array** of all user's ventures (replaced `fetchMyStartup`) |
| `upsertSlides(startupId, slides)` | PUT to `/api/startups/[id]/slides` |
| `upsertLinks(startupId, links)` | PUT to `/api/startups/[id]/links` |
| `upsertTextSections(startupId, sections)` | PUT to `/api/startups/[id]/text-sections` |
| `uploadSlideImage(startupId, file)` | Upload image to Supabase Storage |

**Types added:**
- `EntityType = 'org_project' | 'startup'`
- `StartupSlide`, `StartupLink`, `StartupTextSection`
- `StartupProfile` updated: `startup_email` and `startup_phone` are `string | null`, added `entity_type`, `slides`, `links`, `text_sections`

---

## UI Data Flow

### Creation — `StartupCreateWizard.tsx`

1. **Step 1 (Identity)** has an entity type picker — "Startup" or "Org Project"
2. Choosing entity type selects a different step array:
   - **Startup**: 8 steps — Identity → Description → Branding → Positioning → Edge → Financials → Media → Publish
   - **Org Project**: 5 steps — Identity → Description → Branding → **Showcase** → Publish
3. Step dispatch uses label-based matching (`STEPS[step]?.label === 'Identity'`) not index-based, so different step arrays work without conditional index logic
4. **StepShowcase** (`src/components/startups/StepShowcase.tsx`): lets users add text sections (heading + content) and links (title + URL) during creation
5. On submit: `entity_type` is sent in the POST body. After startup is created, `upsertTextSections` and `upsertLinks` save showcase data

### Editing — `src/app/startups/[id]/edit/page.tsx`

- Loads `entity_type` from existing record
- Conditionally hides startup-only accordion sections for org projects:
  - Hidden: Positioning, Edge, Financials, Media
  - Shown for all: Identity, Description, Branding, ShowcaseEditor
- **ShowcaseEditor** (inline component): add/update/remove for text sections and links, uses dashed border "+" buttons
- On save: nullifies startup-only fields for org projects, saves text sections and links via client API

### Discovery — `src/app/startups/page.tsx`

- Header: "Directory" (not "Startups")
- **Filter pills**: All / Startups / Org Projects — sets `filterEntityType` state → sent as `?entity_type=` param
- **Entity type badge** on PodiumCard and RankedCard: `FolderKanban` icon + "Project" label for `entity_type === 'org_project'`
- **"My Ventures" tab** (replaces "My Startup"):
  - `fetchMyVentures()` returns array (was single object)
  - Renders multiple venture cards with conditional icons, badges, stats
  - Hides "Rounds" stat for org projects
  - Shows `FolderKanban` icon for org projects, `Rocket` icon for startups

### Detail — `StartupProfileView.tsx`

- `isOrgProject = startup.entity_type === 'org_project'`
- **Hidden for org projects**: "Raising" badge, legal status badge, business model badge, Traction & Financials section
- **Changed for org projects**: "Founders" heading → "Team"
- **Added for org projects**: "Org Project" badge with FolderKanban icon
- **Showcase sections** (rendered for all entity types, content-dependent):
  - Text Sections: sorted by `display_order`, rendered as heading + content blocks
  - Slides Gallery: horizontal scroll, 240px wide cards with images and captions
  - Links: grid layout with ExternalLink icons

---

## Key File Locations (Implemented)

| Component | Path |
|---|---|
| Database migration | `supabase/migrations/015_org_projects.sql` |
| Client API + types | `src/api/startups.ts` |
| API - Listing (GET with entity_type filter) | `src/app/api/startups/route.ts` |
| API - CRUD | `src/app/api/startups/[id]/route.ts` |
| API - Text Sections | `src/app/api/startups/[id]/text-sections/route.ts` |
| API - Links | `src/app/api/startups/[id]/links/route.ts` |
| API - Slides | `src/app/api/startups/[id]/slides/route.ts` |
| Directory page | `src/app/startups/page.tsx` |
| Detail page | `src/app/startups/[id]/page.tsx` |
| Profile view component | `src/components/startups/StartupProfileView.tsx` |
| Edit page | `src/app/startups/[id]/edit/page.tsx` |
| Create wizard | `src/components/startups/StartupCreateWizard.tsx` |
| Showcase step (create flow) | `src/components/startups/StepShowcase.tsx` |
| Step 1 Identity (entity picker) | `src/components/startups/Step1Identity.tsx` |

---

## Known Improvements & Technical Debt

### 1. Delete-and-reinsert is not atomic
The showcase PUT routes delete all rows then insert. If the insert fails, old data is lost.
**Fix**: Wrap in a Postgres transaction via `supabase.rpc()` or a database function.

### 2. Co-founder terminology for org projects
`startup_founders` table is reused but the UI terminology should adapt — "Team Members" instead of "Co-Founders", "Invite team member" instead of "Invite co-founder" for org projects.

### 3. `parent_org_id` is unused
Column exists but nothing populates or queries it. Intended for org hierarchy (e.g., a club under a university / E-Cell parenting). Either build the feature or drop the column.

### 4. No PATCH — only full PUT for showcase
Showcase routes require sending the entire array every time. A PATCH endpoint that supports adding/removing/reordering individual items would reduce payload size and eliminate race conditions in concurrent edits.

### 5. No slide upload in create wizard
`StepShowcase` handles text sections and links but not slide images. Users must create the org project first, then go to the edit page to add slides. Adding an image uploader to StepShowcase would complete the creation flow.

### 6. No validation on showcase limits
No cap on how many text sections, links, or slides a user can create. A runaway user could insert thousands.
**Fix**: Add max limits (e.g., 20 sections, 30 links, 50 slides) both client-side and in the API routes.

### 7. GET routes for showcase bypass RLS
The GET handlers in text-sections, links, and slides routes use `createAdminClient()` which bypasses RLS. This means anyone who knows a startup ID can read showcase data even for unpublished startups — the RLS read policy (`is_published = true`) is effectively bypassed.
**Fix**: Use `createAuthClient()` for GET, or add an explicit `is_published` check in the route handler.

### 8. Search doesn't cover showcase content
The keyword search on `GET /api/startups` only queries `startup_profiles` columns. Text section content and link titles are not searchable.
**Fix**: A Postgres full-text search index across showcase tables, or a joined tsvector column on `startup_profiles`.

### 9. No drag-and-drop reordering
Text sections and links have `display_order` but the UI only supports add/remove. A drag-to-reorder interaction (react-dnd or dnd-kit) would make ordering intuitive.

### 10. Cache invalidation is broad
`cacheClearByPrefix('startups')` nukes the entire startup cache on any single update. With entity types creating more cache keys, targeted invalidation (clear only keys matching the updated entity type, or just the updated startup's keys) would be more efficient.

### 11. "Convert to Startup" flow not built
The upgrade path from org project → startup (flip `entity_type`, fill in missing fields) is documented in Approach E's design but not implemented. Would need a modal or wizard that collects legal status, email, phone, and fundraising info before flipping the type.

### 12. Downgrade path not built
Reversing a startup back to org project (Diaspora case) is theoretically possible (flip `entity_type`, nullify funding fields) but no UI flow exists for it.
