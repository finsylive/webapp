# RLS Bypass & Service Key Audit Report

**Date:** 2026-03-06
**Scope:** All API routes and library files in `src/`

---

## Executive Summary

The app uses two Supabase client types defined in `src/utils/supabase-server.ts`:

| Client | Key | RLS Enforced | Usage |
|--------|-----|-------------|-------|
| `createAuthClient()` | Anon key + user cookies | YES | 75 API routes |
| `createAdminClient()` | Service role key | **NO** | 10 files |

Additionally, **7 routes** create raw anon clients (`createClient`) without user session, and **3 push notification routes** pass the service role key directly to Edge Functions.

---

## CRITICAL Issues

### 1. Push Notification Routes - No Auth, Service Key Exposed to Edge Functions

**Files:**
- `src/app/api/push-on-mention/route.ts`
- `src/app/api/push-on-reply/route.ts`
- `src/app/api/push-notification/route.ts`

**Problem:** These routes accept POST requests with user-provided `mentionerId`, `replierId`, etc. in the request body. They perform **zero authentication** — no `getUser()` call, no session check. They then forward the request to Supabase Edge Functions using the `SUPABASE_SERVICE_ROLE_KEY`.

**Impact:** Any unauthenticated user can:
- Trigger push notifications to any user
- Spoof `mentionerId`/`replierId` to impersonate others
- Spam notification endpoints

**Fix:** Add `createAuthClient()` + `getUser()` auth check. Derive `mentionerId`/`replierId` from the authenticated session, not the request body.

---

### 2. Project Sub-Resource Routes - Write Operations Without Auth

**Files:**
- `src/app/api/users/[username]/projects/[projectId]/links/route.ts` (POST)
- `src/app/api/users/[username]/projects/[projectId]/links/[linkId]/route.ts` (PUT, DELETE)
- `src/app/api/users/[username]/projects/[projectId]/slides/[slideId]/route.ts` (PUT, DELETE)
- `src/app/api/users/[username]/projects/[projectId]/slides/normalize/route.ts` (POST)
- `src/app/api/users/[username]/projects/[projectId]/text_sections/[sectionId]/route.ts` (PUT, DELETE)

**Problem:** These routes use a raw anon Supabase client (`createClient` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`). They verify project ownership by checking the `username` URL parameter against the database, but they **never authenticate the caller**. There is no `getUser()` call.

**Impact:** Any unauthenticated user can:
- Add, edit, or delete links on any user's project
- Modify or delete slides on any user's project
- Modify or delete text sections on any user's project

As long as they know the username and project ID (both visible in URLs), they can write to those resources. RLS alone cannot protect here because the client has no user session attached — the anon key has no identity context for RLS `auth.uid()` checks.

**Fix:** Switch to `createAuthClient()`. Add `getUser()` check. Verify `auth.uid()` matches the project owner before any write operation.

---

### 3. Feed Experiments - Unrestricted Create/Update

**File:** `src/lib/feed/experiments.ts`

**Problem:** `createExperiment()` and `updateExperiment()` use `createAdminClient()` (service role, bypasses RLS). These functions have **no user ID parameter** and **no access control**. They are called from API routes.

**Impact:** If the calling API route doesn't enforce admin-only access, any authenticated user could create or modify feed experiments, altering the feed algorithm for all users.

**Fix:** Add admin role verification in the calling API routes (`src/app/api/feed/experiments/route.ts` and `src/app/api/feed/experiments/[id]/route.ts`). Only allow users with an admin flag to create/update experiments.

---

## HIGH Issues

### 4. Feed Library Functions - Admin Client with External userId

**Files:**
- `src/lib/feed/cache-manager.ts`
- `src/lib/feed/realtime-injector.ts`
- `src/lib/feed/interest-profile.ts`
- `src/lib/feed/feature-extractor.ts`
- `src/lib/feed/candidate-generator.ts`

**Problem:** All these functions use `createAdminClient()` and accept a `userId` parameter. The admin client bypasses RLS entirely. The functions trust the `userId` passed to them — they don't verify it.

**Current mitigation:** The calling API routes (e.g., `src/app/api/feed/route.ts`) do call `getUser()` and pass the authenticated user's ID. So in practice, the `userId` comes from the session.

**Risk:** If any new code calls these functions with a user-supplied `userId` without first authenticating, it would allow cross-user data access (reading another user's feed cache, interest profile, interaction graph).

**Fix:** Either:
- Pass the authenticated Supabase client instead of a raw `userId` (preferred)
- Add clear JSDoc warnings that `userId` MUST come from an authenticated session
- Consider whether these functions actually need admin access, or if RLS-compatible queries would work

---

### 5. Verify Routes - Admin Client (Justified but Worth Noting)

**Files:**
- `src/app/api/verify/send/route.ts`
- `src/app/api/verify/confirm/route.ts`

**Problem:** These use `createAdminClient()` to manage the `verification_codes` table and update `users.is_verified`.

**Mitigation:** Both routes authenticate the user first via `createAuthClient()` + `getUser()`. The admin client is only used because RLS may not grant the user write access to `verification_codes` or the ability to update their own `is_verified` flag.

**Status:** Acceptable, but consider adding RLS policies that allow users to insert their own verification codes and update their own `is_verified`, so the admin client isn't needed.

---

### 6. Account Deletion - Admin Client (Justified)

**File:** `src/app/api/users/account/route.ts`

**Problem:** Uses `createAdminClient()` for `auth.admin.deleteUser()`.

**Mitigation:** Authenticates user first. Admin client is necessary because only service role can call `auth.admin.deleteUser()`.

**Status:** Acceptable. This is the correct pattern for account deletion.

---

## LOW Issues

### 7. Read-Only Anon Routes (Acceptable)

**Files:**
- `src/app/api/posts/[postId]/replies/route.ts` (GET only)
- `src/app/api/resources/[id]/route.ts` (GET only)
- `src/app/api/environments/route.ts` (GET only)

**Status:** These are read-only and return public data. Using an anon client without auth is acceptable here, assuming RLS policies on the underlying tables allow public reads.

---

## Summary Table

| # | Severity | Route/File | Issue | Auth Check |
|---|----------|-----------|-------|------------|
| 1 | CRITICAL | `push-on-mention/route.ts` | Service key, no auth | NO |
| 1 | CRITICAL | `push-on-reply/route.ts` | Service key, no auth | NO |
| 1 | CRITICAL | `push-notification/route.ts` | Service key, no auth | NO |
| 2 | CRITICAL | `projects/[projectId]/links/route.ts` | Write ops, anon client, no auth | NO |
| 2 | CRITICAL | `projects/[projectId]/links/[linkId]/route.ts` | Write ops, anon client, no auth | NO |
| 2 | CRITICAL | `projects/[projectId]/slides/[slideId]/route.ts` | Write ops, anon client, no auth | NO |
| 2 | CRITICAL | `projects/[projectId]/slides/normalize/route.ts` | Write ops, anon client, no auth | NO |
| 2 | CRITICAL | `projects/[projectId]/text_sections/[sectionId]/route.ts` | Write ops, anon client, no auth | NO |
| 3 | CRITICAL | `lib/feed/experiments.ts` | Unrestricted create/update experiments | NO |
| 4 | HIGH | `lib/feed/cache-manager.ts` | Admin client trusts external userId | Indirect |
| 4 | HIGH | `lib/feed/realtime-injector.ts` | Admin client trusts external userId | Indirect |
| 4 | HIGH | `lib/feed/interest-profile.ts` | Admin client trusts external userId | Indirect |
| 4 | HIGH | `lib/feed/feature-extractor.ts` | Admin client trusts external userId | Indirect |
| 4 | HIGH | `lib/feed/candidate-generator.ts` | Admin client trusts external userId | Indirect |
| 5 | LOW | `verify/send/route.ts` | Admin client (justified) | YES |
| 5 | LOW | `verify/confirm/route.ts` | Admin client (justified) | YES |
| 6 | LOW | `users/account/route.ts` | Admin client (justified) | YES |

---

## Remediation Priority

1. **Immediate:** Add auth to push notification routes (Issues 1)
2. **Immediate:** Switch project sub-resource routes to `createAuthClient()` + auth check (Issue 2)
3. **Soon:** Add admin role check to experiment create/update endpoints (Issue 3)
4. **Medium-term:** Refactor feed library to not rely on admin client where possible (Issue 4)
5. **Low priority:** Consider RLS policies for verification flow (Issue 5)
