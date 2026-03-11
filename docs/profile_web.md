# Profile Section — API & Page Reference

This document covers every API route, page, and component involved in the user profile section. Use this as a reference when building client-side integrations.

---

## Base URL

All routes are relative to the app origin, e.g. `https://ments.app`.

---

## Authentication

Most write operations require the user to be authenticated via session cookie (`sb-web-auth`). The server reads the cookie and validates the session. If unauthenticated, the endpoint returns `401 { error: 'Not authenticated' }`.

Ownership checks: write operations on profile sub-resources (education, experience, positions, projects) verify that `session.user.id` matches the resource owner's `user_id`. Returns `403` if not the owner.

---

## 1. User Lookup

### `GET /api/users`
Look up a user by field.

| Query Param | Type | Description |
|---|---|---|
| `id` | string | Filter by user UUID |
| `email` | string | Filter by email |
| `username` | string | Filter by username |

**Response**
```json
{
  "data": {
    "id": "uuid",
    "username": "string",
    "full_name": "string",
    "avatar_url": "string | null",
    "tagline": "string | null",
    "current_city": "string | null",
    "user_type": "string",
    "is_verified": false,
    "is_onboarding_done": true,
    "created_at": "iso8601",
    "last_seen": "iso8601 | null"
  }
}
```

---

### `GET /api/users/by-id/[id]`
Get minimal user info by UUID.

**Response**
```json
{ "data": { "id": "uuid", "username": "string" } }
```

---

### `GET /api/users/search`
Full-text search for users.

| Query Param | Type | Required |
|---|---|---|
| `q` | string | Yes |

**Response**
```json
{
  "data": [
    { "id": "uuid", "username": "string", "full_name": "string", "avatar_url": "string | null", "tagline": "string | null", "current_city": "string | null", "user_type": "string", "is_verified": false }
  ]
}
```

---

## 2. Profile

### `GET /api/users/[username]/profile`
Full profile for a user. The main endpoint powering the public profile page.

| Query Param | Type | Description |
|---|---|---|
| `viewerId` | string (UUID) | Optional — used to populate `viewer.is_following` |

**Response**
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "username": "string",
      "full_name": "string",
      "avatar_url": "string | null",
      "banner_image": "string | null",
      "tagline": "string | null",
      "current_city": "string | null",
      "user_type": "string",
      "is_verified": false,
      "about": "string | null",
      "bio": "string | null",
      "skills": ["string"],
      "looking_for": ["string"],
      "investor_status": "string | null",
      "linkedin": "string | null",
      "social_links": {},
      "show_projects": true,
      "show_startups": true
    },
    "counts": {
      "followers": 0,
      "following": 0,
      "projects": 0,
      "portfolios": 0,
      "startups": 0
    },
    "experiences": [
      {
        "id": "uuid",
        "company_name": "string",
        "domain": "string | null",
        "sort_order": 0,
        "positions": [
          {
            "id": "uuid",
            "position": "string",
            "start_date": "YYYY-MM",
            "end_date": "YYYY-MM | null",
            "description": "string | null",
            "sort_order": 0
          }
        ]
      }
    ],
    "education": [
      {
        "id": "uuid",
        "institution_name": "string",
        "institution_domain": "string | null",
        "degree": "string | null",
        "field_of_study": "string | null",
        "start_date": "YYYY-MM",
        "end_date": "YYYY-MM | null",
        "description": "string | null",
        "sort_order": 0
      }
    ],
    "startups": [
      { "id": "uuid", "brand_name": "string", "stage": "string", "is_actively_raising": false }
    ],
    "projects": [
      { "id": "uuid", "title": "string", "tagline": "string | null", "cover_url": "string | null", "logo_url": "string | null", "created_at": "iso8601" }
    ],
    "viewer": { "is_following": false }
  }
}
```

---

### `PATCH /api/users/[username]/profile`
Update own profile fields. Auth required. Must be the profile owner.

**Request body** (all fields optional):
```json
{
  "full_name": "string",
  "tagline": "string",
  "about": "string",
  "current_city": "string",
  "avatar_url": "string",
  "banner_image": "string",
  "linkedin": "string",
  "social_links": {},
  "skills": ["string"],
  "looking_for": ["string"],
  "show_projects": true,
  "show_startups": true
}
```

**Response**: `{ "success": true }`

---

## 3. Follow / Unfollow

### `POST /api/users/[username]/follow`
Follow or unfollow a user. Auth required.

**Request body**:
```json
{ "follow": true }
```
Set `follow: false` to unfollow.

**Response**: `{ "success": true }`

> A push notification is fired to the followed user (best-effort via edge function).

---

### `GET /api/users/[username]/followers`
List followers of a user.

| Query Param | Type | Default |
|---|---|---|
| `viewerId` | string | — |
| `limit` | number | 50 (max 200) |
| `offset` | number | 0 |

**Response**:
```json
{
  "data": [
    { "id": "uuid", "username": "string", "full_name": "string", "avatar_url": "string | null", "is_verified": false, "is_following": false }
  ]
}
```

---

### `GET /api/users/[username]/following`
List users that `[username]` follows.

| Query Param | Type | Default |
|---|---|---|
| `limit` | number | 50 (max 200) |
| `offset` | number | 0 |

**Response**:
```json
{
  "data": [
    { "id": "uuid", "username": "string", "full_name": "string", "avatar_url": "string | null", "is_verified": false }
  ]
}
```

---

## 4. Education

### `GET /api/users/[username]/education`
List education entries.

| Query Param | Type | Description |
|---|---|---|
| `id` | string | Filter to a single entry |

**Response**:
```json
{
  "data": {
    "education": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "institution_name": "string",
        "institution_domain": "string | null",
        "degree": "string | null",
        "field_of_study": "string | null",
        "start_date": "YYYY-MM",
        "end_date": "YYYY-MM | null",
        "description": "string | null",
        "sort_order": 0
      }
    ]
  }
}
```

---

### `POST /api/users/[username]/education`
Add an education entry. Auth required (profile owner).

**Request body**:
```json
{
  "institution_name": "string",
  "institution_domain": "string | null",
  "degree": "string | null",
  "field_of_study": "string | null",
  "start_date": "YYYY-MM | null",
  "end_date": "YYYY-MM | null",
  "description": "string | null"
}
```

**Response** (201): `{ "data": { "id": "uuid" } }`

---

### `PATCH /api/users/[username]/education`
Update a single entry or reorder. Auth required (profile owner).

**Mode 1 — Reorder**:
```json
{ "order": ["uuid", "uuid", "uuid"] }
```

**Mode 2 — Update single**:
```json
{
  "id": "uuid",
  "institution_name": "string",
  "degree": "string | null",
  "field_of_study": "string | null",
  "start_date": "YYYY-MM | null",
  "end_date": "YYYY-MM | null",
  "description": "string | null"
}
```

**Response**: `{ "success": true }`

---

### `DELETE /api/users/[username]/education`
Delete an education entry. Auth required (profile owner).

| Query Param | Type | Required |
|---|---|---|
| `id` | string | Yes |

**Response**: `{ "success": true }`

---

## 5. Work Experience

### `GET /api/users/[username]/work-experience`
List work experiences with nested positions.

| Query Param | Type | Description |
|---|---|---|
| `id` | string | Filter to a single experience |

**Response**:
```json
{
  "data": {
    "experiences": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "company_name": "string",
        "domain": "string | null",
        "sort_order": 0,
        "positions": [
          {
            "id": "uuid",
            "experience_id": "uuid",
            "position": "string",
            "start_date": "YYYY-MM",
            "end_date": "YYYY-MM | null",
            "description": "string | null",
            "sort_order": 0
          }
        ]
      }
    ]
  }
}
```

---

### `POST /api/users/[username]/work-experience`
Create a work experience (company record). Auth required (profile owner).

```json
{ "companyName": "string", "domain": "string | null" }
```

**Response** (201): `{ "data": { "id": "uuid" } }`

---

### `PATCH /api/users/[username]/work-experience`
Update or reorder. Auth required (profile owner).

**Reorder**: `{ "order": ["uuid", ...] }`

**Update**: `{ "id": "uuid", "company_name": "string", "domain": "string | null" }`

**Response**: `{ "success": true }`

---

### `DELETE /api/users/[username]/work-experience`
Delete experience + all its positions (cascade). Auth required (profile owner).

| Query Param | Required |
|---|---|
| `id` | Yes |

**Response**: `{ "success": true }`

---

## 6. Positions (within Work Experience)

Positions are roles held at a company. Each experience can have multiple positions.

### `GET /api/users/[username]/positions`

| Query Param | Type | Description |
|---|---|---|
| `experienceId` | string | Filter by parent experience |

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "experience_id": "uuid",
      "position": "string",
      "start_date": "YYYY-MM | null",
      "end_date": "YYYY-MM | null",
      "description": "string | null",
      "sort_order": 0,
      "work_experience": { "id": "uuid", "company_name": "string", "user_id": "uuid" }
    }
  ],
  "count": 0
}
```

---

### `POST /api/users/[username]/positions`
Add a position. Auth required (profile owner of parent experience).

```json
{
  "experienceId": "uuid",
  "position": "string",
  "description": "string | null",
  "startDate": "YYYY-MM | null",
  "endDate": "YYYY-MM | null"
}
```

**Response** (201):
```json
{ "data": { "id": "uuid", "experience_id": "uuid", "position": "string", "description": "string | null", "start_date": "YYYY-MM | null", "end_date": "YYYY-MM | null", "sort_order": 0 } }
```

---

### `PATCH /api/users/[username]/positions`
Update a position. Auth required (profile owner).

```json
{
  "id": "uuid",
  "position": "string",
  "description": "string | null",
  "startDate": "YYYY-MM | null",
  "endDate": "YYYY-MM | null"
}
```

**Response**: Same shape as POST response.

---

## 7. Projects

### `GET /api/users/[username]/projects`
List projects for a user.

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "owner_id": "uuid",
      "title": "string",
      "category": "string",
      "tagline": "string | null",
      "cover_url": "string | null",
      "logo_url": "string | null",
      "visibility": "public | private | unlisted",
      "created_at": "iso8601",
      "sort_order": 0
    }
  ]
}
```

---

### `POST /api/users/[username]/projects`
Create a project. Auth required (profile owner).

```json
{
  "title": "string",
  "category": "string",
  "tagline": "string | null",
  "cover_url": "string | null",
  "logo_url": "string | null",
  "visibility": "public"
}
```

**Response** (201): Full project object.

**Valid categories**: See `src/lib/projectCategories.ts` — includes Web App, Mobile App, AI / ML, Design, UI / UX, Startup / Business, Research Paper, and 30+ others.

---

### `GET /api/users/[username]/projects/[projectId]`
Get a single project.

**Response**: `{ "data": { ...project } }`

---

### `PUT /api/users/[username]/projects/[projectId]`
Update a project. Auth required (project owner).

All fields optional:
```json
{
  "title": "string",
  "category": "string",
  "tagline": "string | null",
  "cover_url": "string | null",
  "logo_url": "string | null",
  "visibility": "public | private | unlisted"
}
```

**Response**: `{ "data": { ...updated project } }`

---

### `DELETE /api/users/[username]/projects/[projectId]`
Delete a project. Auth required (project owner).

**Response**: `{ "ok": true }`

---

### `GET /api/users/[username]/projects/[projectId]/slides`
List project image slides.

**Response**:
```json
{
  "data": [
    { "id": "uuid", "project_id": "uuid", "slide_url": "string", "caption": "string | null", "slide_number": 0, "created_at": "iso8601" }
  ]
}
```

---

### `POST /api/users/[username]/projects/[projectId]/slides`
Add a slide. Auth required (project owner).

```json
{ "slide_url": "string", "caption": "string | null", "slide_number": 0 }
```

**Response** (201): Slide object.

---

### `GET /api/users/[username]/projects/[projectId]/links`
List project links.

**Response**:
```json
{
  "data": [
    { "id": "uuid", "project_id": "uuid", "title": "string", "url": "string", "icon_name": "string | null", "display_order": 0, "created_at": "iso8601" }
  ]
}
```

---

### `POST /api/users/[username]/projects/[projectId]/links`
Add a link. Auth required (project owner).

```json
{ "title": "string", "url": "string", "icon_name": "string | null", "display_order": 0 }
```

**Response** (201): Link object.

---

### `GET /api/users/[username]/projects/[projectId]/text_sections`
List project text/description sections.

**Response**:
```json
{
  "data": [
    { "id": "uuid", "project_id": "uuid", "heading": "string", "content": "string", "display_order": 0, "created_at": "iso8601" }
  ]
}
```

---

### `POST /api/users/[username]/projects/[projectId]/text_sections`
Add a text section. Auth required (project owner).

```json
{ "heading": "string", "content": "string", "display_order": 0 }
```

**Response** (201): Text section object.

---

## 8. Portfolios

### `GET /api/users/[username]/portfolios`
List portfolios with platform links.

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "title": "string | null",
      "description": "string | null",
      "created_at": "iso8601",
      "updated_at": "iso8601",
      "platforms_links": [
        { "portfolio_id": "uuid", "platform": "github | figma | dribbble | behance | linkedin | youtube | notion | substack | custom", "link": "string" }
      ]
    }
  ]
}
```

---

### `POST /api/users/[username]/portfolios`
Create or update portfolio + platform links. Auth required (profile owner).

```json
{
  "title": "string | null",
  "description": "string | null",
  "forceNew": false,
  "platforms": [
    { "platform": "github", "link": "https://github.com/user" }
  ]
}
```

**Response**: `{ "success": true, "portfolio_id": "uuid" }`

---

### `DELETE /api/users/[username]/portfolios`
Delete a portfolio. Auth required (profile owner).

| Query Param | Description |
|---|---|
| `id` | Portfolio UUID. If omitted, deletes the latest. |

**Response**: `{ "success": true, "id": "uuid" }`

---

## 9. Account Management

### `GET /api/users/profile-completion`
Get profile completion percentage + checklist. Auth required.

**Response**:
```json
{
  "username": "string",
  "percentage": 60,
  "checklist": {
    "avatar": true,
    "bio": false,
    "education": true,
    "experience": false,
    "project": false,
    "portfolio": false,
    "skills": true
  }
}
```

---

### `PATCH /api/users/account`
Deactivate or reactivate account. Auth required.

```json
{ "action": "deactivate" }
```

or

```json
{ "action": "reactivate" }
```

**Response**: `{ "success": true, "message": "string" }`

---

### `DELETE /api/users/account`
Permanently delete account. Auth required. Irreversible.

```json
{ "reason": "string | null" }
```

**Response**: `{ "success": true, "message": "Account permanently deleted" }`

---

## 10. Date Format Convention

All date fields (education `start_date`/`end_date`, experience positions `start_date`/`end_date`) use `YYYY-MM` string format (year-month only, no day). `null` in `end_date` means the entry is current/ongoing.

---

## 11. Key Pages (Frontend Routes)

| Route | Description |
|---|---|
| `/profile/[username]` | Public profile view |
| `/profile/[username]/edit` | Edit own profile (avatar, bio, skills, links) |
| `/profile/[username]/education/edit` | Manage education entries (reorder, delete) |
| `/profile/[username]/education/create` | Add a new education entry |
| `/profile/[username]/education/[id]/edit` | Edit an existing education entry |
| `/profile/[username]/experiences/edit` | Manage work experience + positions |
| `/profile/[username]/experiences/create` | Add a new company |
| `/profile/[username]/experiences/[id]/edit` | Edit company + add/edit/delete positions |
| `/profile/[username]/projects` | Projects listing for a user |
| `/startups/[id]/edit` | Edit a startup (separate from projects) |
| `/settings` | Account settings (deactivate/delete) |

---

## 12. Storage (Images)

Profile images are uploaded to Supabase Storage buckets before passing URLs to the API:

| Use | Bucket | Notes |
|---|---|---|
| Avatar | `avatars` | Square; compressed to ~512px before upload |
| Cover/Banner | `banners` | Wide; compressed to ~1600px |
| Project cover | `project-covers` | |
| Project logo | `project-logos` | |
| Project slides | `project-slides` | |

Upload flow: pick file → compress (`compressImage`) → upload to storage → get public URL → save via API.
