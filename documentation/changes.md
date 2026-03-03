# Branch: `onboarding-startup-experiment` — Full Changelog

> **Base branch:** `main`
> **Commits:** 4 committed + uncommitted staged changes
> **Total files touched:** 23 (14 modified, 5 deleted, 8 new)
> **Net diff:** +1,333 lines / -1,407 lines

---

## Table of Contents

1. [Commit History](#commit-history)
2. [Change 1: Navigation Redesign](#change-1-navigation-redesign)
3. [Change 2: Create Post Modal & Inline Prompt on Feed](#change-2-create-post-modal--inline-prompt-on-feed)
4. [Change 3: CreatePostInput UI Overhaul](#change-3-createpostinput-ui-overhaul)
5. [Change 4: UserAvatar Reusable Component](#change-4-useravatar-reusable-component)
6. [Change 5: Dashboard Sidebar Widgets Cleanup](#change-5-dashboard-sidebar-widgets-cleanup)
7. [Change 6: Startup Onboarding Wizard — 8-Step Redesign](#change-6-startup-onboarding-wizard--8-step-redesign)
8. [Change 7: Database Migration — New Startup Columns](#change-7-database-migration--new-startup-columns)
9. [Change 8: Startup API Enhancements](#change-8-startup-api-enhancements)
10. [Change 9: Startup Edit Page Update](#change-9-startup-edit-page-update)
11. [Change 10: Housekeeping (.env.example, .gitignore, UX docs)](#change-10-housekeeping)
12. [Deleted Files](#deleted-files)
13. [New Files](#new-files)

---

## Commit History

| Hash | Message | Summary |
|------|---------|---------|
| `e43dd7c` | `feat: redesign nav, create post modal, and sidebar widgets` | Full nav restructure, removed Create/People/Settings from sidebar, added Search & Messages nav items, moved Settings to header icon, cleaned up sidebar widgets (removed Recent Chats & My Posts widgets), redesigned mobile nav bar |
| `7dfd1e8` | `feat: add UserAvatar component with fallback + UX documentation` | Created reusable `UserAvatar` component with deterministic gradient fallbacks, replaced all ad-hoc avatar rendering across the codebase, added `ux1.md` documentation |
| `1231510` | `feat: compact inline create post prompt on feed` | Added a compact "What's on your mind?" input bar on the home feed with floating action button, full-screen create post modal, replaced the direct `/create` page rendering |
| `69ddaf9` | `chore: add .env.example with placeholder values` | Added `.env.example` for new developer onboarding, updated `.gitignore` to allow it |
| *(uncommitted)* | Startup onboarding rewrite | 5→8 step wizard, new step files, DB migration, API additions, edit page updates |

---

## Change 1: Navigation Redesign

### Prompt / Intent
Redesign the navigation to feel more like a modern social platform (similar to Instagram/LinkedIn). Remove the "Create Post" link from nav since it's moving to an inline modal. Add Messages directly to the sidebar. Remove Settings from the sidebar and move it to a header icon. Remove the People link.

### Files Modified

#### `src/components/layout/Sidebar.tsx`
**What changed:**
- Removed `Plus`, `Users`, `Settings` icon imports
- Added `UserAvatar` component import
- Sidebar now accepts an `unreadMessages` prop
- Navigation items restructured:
  - **Removed:** `Create Post (/create)`, `People (/people)`, `Settings (/settings)`
  - **Added:** `Search (/search)` with custom SVG icon, `Messages (/messages)` with unread badge and custom SVG icon
- The user profile card at the bottom now uses the `UserAvatar` component instead of inline `<Image>` / fallback div logic

```tsx
// BEFORE — navigation items
const navItems = [
  { href: '/', icon: HomeIcon, label: 'Home' },
  { href: '/create', icon: Plus, label: 'Create Post' },
  { href: '/startups', icon: Rocket, label: 'Startups' },
  { href: '/people', icon: Users, label: 'People' },
  { href: '/hub', icon: HubIcon, label: 'Hub' },
  { href: profileHref, icon: User, label: 'Profile' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

// AFTER — navigation items
const navItems = [
  { href: '/', icon: HomeIcon, label: 'Home' },
  { href: '/search', icon: SearchIcon, label: 'Search' },
  { href: '/messages', icon: MessageIcon, label: 'Messages', count: unreadMessages },
  { href: '/startups', icon: Rocket, label: 'Startups' },
  { href: '/hub', icon: HubIcon, label: 'Hub' },
  { href: profileHref, icon: User, label: 'Profile' },
];
```

```tsx
// BEFORE — Profile avatar in sidebar (24 lines of inline Image + fallback)
{userProfile?.avatar_url ? (
  <div className="h-10 w-10 rounded-full overflow-hidden">
    <Image src={toProxyUrl(userProfile.avatar_url, { width: 40, quality: 82 })} ... />
  </div>
) : (
  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-primary to-primary/80">
    <span className="text-sm font-bold text-primary-foreground">
      {userProfile?.full_name?.charAt(0) || ...}
    </span>
  </div>
)}

// AFTER — Clean single component
<UserAvatar
  src={userProfile?.avatar_url}
  alt={userProfile?.full_name || 'Profile'}
  fallbackText={userProfile?.full_name || user.user_metadata?.full_name || user.email || 'U'}
  size={40}
/>
```

#### `src/components/layout/MobileNavBar.tsx`
**What changed:**
- Added `UserAvatar` import
- Added a new `Messages` nav item with the custom message SVG icon
- Replaced the inline profile avatar rendering (Image + fallback div, ~15 lines) with a single `<UserAvatar>` call
- Mobile nav items are now: Home, Search, Messages, Startups, Hub, Profile (removed Create/Settings)

```tsx
// NEW Messages nav item added to mobile
<Link
  href="/messages"
  className={`flex flex-col items-center justify-center p-2 ${pathname.startsWith('/messages') ? 'text-primary' : 'text-muted-foreground'}`}
>
  <Image src="/icons/message.svg" alt="Messages" width={20} height={20} />
  <span className="text-[11px] font-medium mt-1">Messages</span>
</Link>
```

#### `src/components/layout/ChatLayout.tsx`
**What changed:**
- Removed `MessageCircle`, `Settings`, `Plus` icon imports
- Added `Rocket` import
- Navigation items restructured identically to the sidebar:
  - **Removed:** `Create Post`, `Messages` (with MessageCircle icon), `Projects`, `Settings`
  - **Added:** `Messages` (with custom SVG icon), `Startups` (with Rocket icon)

```tsx
// BEFORE
{ href: '/create', icon: Plus, label: 'Create Post' },
{ href: '/messages', icon: MessageCircle, label: 'Messages' },
{ href: '/projects', icon: ProjectIcon, label: 'Projects' },
{ href: '/settings', icon: Settings, label: 'Settings' },

// AFTER
{ href: '/messages', icon: MessageSvgIcon, label: 'Messages' },
{ href: '/startups', icon: Rocket, label: 'Startups' },
```

#### `src/components/layout/DashboardLayout.tsx`
**What changed:**
- Added `Settings` icon import (moved here from sidebar)
- Header top-bar actions simplified:
  - **Removed:** Search icon button, Messages icon button (both now in sidebar)
  - **Kept:** Notifications icon button
  - **Added:** Settings gear icon button
- `unreadMessages` count is now passed down to `<Sidebar>` as a prop

```tsx
// BEFORE — Header actions (Search, Messages, Notifications)
<Link href="/search"><Image src="/icons/search.svg" ... /></Link>
<Link href="/messages"><Image src="/icons/message.svg" ... /></Link>
<Link href="/notifications"><Image src="/icons/notification.svg" ... /></Link>

// AFTER — Header actions (Notifications, Settings)
<Link href="/notifications"><Image src="/icons/notification.svg" ... /></Link>
<Link href="/settings"><Settings className="h-5 w-5" /></Link>
```

```tsx
// Sidebar now gets unread messages count
<Sidebar unreadMessages={unreadMessages} />
```

---

## Change 2: Create Post Modal & Inline Prompt on Feed

### Prompt / Intent
Instead of navigating to `/create` to write a post, add a compact LinkedIn/Facebook-style "What's on your mind?" inline prompt at the top of the home feed. Clicking it opens a full modal with the `CreatePostInput` component. Also add a floating action button (FAB) in the bottom-right corner for quick access.

### File Modified: `src/app/page.tsx`

**What changed:**
- Added a new `AuthenticatedHome` component (extracted from the inline JSX)
- Added imports: `CreatePostInput`, `UserAvatar`, `Image`, `VideoIcon`, `BarChart2`, `Plus`, `X`
- Removed unused imports: `Users`, `Rocket`, `Sparkles`
- The authenticated home now renders:
  1. **Compact inline prompt** — avatar + "What's on your mind?" pill + Photo/Video/Poll action buttons
  2. **Floating Action Button (FAB)** — fixed position bottom-right, opens the same modal
  3. **Create Post Modal** — full overlay with backdrop blur, scrollable, contains `<CreatePostInput>`
  4. **PersonalizedFeed** — now keyed by `feedKey` state that increments on post creation (triggers re-render)

```tsx
// NEW — AuthenticatedHome component (entire thing is new)
function AuthenticatedHome() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [feedKey, setFeedKey] = useState(0);

  const handlePostCreated = useCallback(() => {
    setShowCreateModal(false);
    setFeedKey((k) => k + 1);
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Compact Create Post Prompt */}
        <div
          className="bg-card border border-border rounded-2xl p-3 shadow-sm cursor-pointer hover:bg-accent/30 transition-colors"
          onClick={() => setShowCreateModal(true)}
        >
          <div className="flex items-center gap-3">
            <UserAvatar
              src={user?.user_metadata?.avatar_url}
              alt={user?.user_metadata?.full_name || 'User'}
              fallbackText={user?.user_metadata?.full_name || user?.email || 'U'}
              size={36}
            />
            <div className="flex-1 px-4 py-2 bg-muted/50 rounded-full text-sm text-muted-foreground">
              What&apos;s on your mind?
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2.5 ml-12">
            <button type="button" className="... text-emerald-600 ...">
              <ImageIcon size={14} /> <span className="hidden sm:inline">Photo</span>
            </button>
            <button type="button" className="... text-blue-600 ...">
              <VideoIcon size={14} /> <span className="hidden sm:inline">Video</span>
            </button>
            <button type="button" className="... text-amber-600 ...">
              <BarChart2 size={14} /> <span className="hidden sm:inline">Poll</span>
            </button>
          </div>
        </div>

        <PersonalizedFeed key={feedKey} />
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary ..."
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black/50 ..." onClick={() => setShowCreateModal(false)} />
          <div className="flex min-h-full items-start justify-center px-4 py-10">
            <div className="... w-full max-w-2xl bg-background rounded-2xl shadow-2xl ...">
              <div className="sticky top-0 ... flex items-center justify-between ...">
                <h2 className="text-xl font-semibold">Create Post</h2>
                <button onClick={() => setShowCreateModal(false)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 overflow-y-auto max-h-[65vh]">
                <CreatePostInput onPostCreated={handlePostCreated} />
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
```

### File Modified: `src/app/create/page.tsx`
**What changed:**
- The `/create` page still exists but is simplified
- Removed the "Select Environment" heading label (it's inside `CreatePostInput` now)
- Wrapped `CreatePostInput` in a card container: `bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm`

```tsx
// BEFORE
<div className="space-y-6">
  <div>
    <h2 className="text-sm font-semibold text-muted-foreground mb-2">Select Environment</h2>
    <CreatePostInput initialPostType={initialPostType} />
  </div>
</div>

// AFTER
<div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-sm">
  <CreatePostInput initialPostType={initialPostType} />
</div>
```

---

## Change 3: CreatePostInput UI Overhaul

### Prompt / Intent
Redesign the create post form to feel more like Facebook/LinkedIn's create post composer. The form was previously a full-page form with a card wrapper, labeled sections, and a bulky environment selector with chip buttons. The new design has: author row (avatar + name + dropdown environment selector), minimal borderless textarea, bottom attachment toolbar, and a rounded "Post" button.

### File Modified: `src/components/posts/CreatePostInput.tsx`

**Key changes:**

1. **Removed the outer card wrapper** — The `<form>` now has no wrapping `<div>` with card styles; it's just `<form onSubmit={handleSubmit}>`
2. **Author row** — Shows avatar + user's display name + compact environment dropdown button
3. **Environment selector** — Changed from inline chip grid to a popover dropdown:
   - Button shows selected env name with a `<ChevronDown>` chevron
   - Click opens a floating dropdown with search + scrollable list
   - Click outside closes it (via `mousedown` listener)
4. **Textarea** — Now borderless and transparent (`bg-transparent`, no border/ring)
5. **Post type selector** — Moved from 3 grid buttons at the top to an "Add to your post" toolbar at the bottom with icon-only toggle buttons (Photo, Video, Poll)
6. **Footer** — Character count + "Post" button (rounded pill style) in a flex row
7. **Removed `Button` component import** — Now uses a native `<button>` with custom Tailwind styles
8. **New imports:** `ChevronDown`, `Globe`, `UserAvatar`

```tsx
// BEFORE — Environment selector was a chip grid:
<div className="flex gap-2 overflow-x-auto md:flex-wrap">
  {environments.map((env) => (
    <button className={`flex items-center gap-2 px-3 h-9 rounded-2xl border ...`}>
      <Image src={env.picture} ... />
      <span>{env.name}</span>
    </button>
  ))}
</div>

// AFTER — Environment selector is a dropdown popover:
<button
  type="button"
  onClick={() => setIsEnvDropdownOpen(!isEnvDropdownOpen)}
  className="flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-muted/50 hover:bg-muted border border-border rounded-lg text-sm ..."
>
  {selectedEnvironment?.picture ? <Image ... /> : <Globe className="h-3.5 w-3.5" />}
  <span>{selectedEnvironment?.name || 'Select environment'}</span>
  <ChevronDown size={14} className={`... ${isEnvDropdownOpen ? 'rotate-180' : ''}`} />
</button>

{isEnvDropdownOpen && (
  <div className="absolute top-full left-0 mt-2 w-64 bg-popover rounded-xl shadow-xl border border-border z-50 ...">
    <div className="p-2 border-b border-border">
      <input placeholder="Search environments..." ... />
    </div>
    <div className="max-h-48 overflow-y-auto p-1.5">
      {filteredEnvs.map(env => (
        <button onClick={() => { setSelectedEnvironment(env); setIsEnvDropdownOpen(false); }} ...>
          {env.name}
        </button>
      ))}
    </div>
  </div>
)}
```

```tsx
// BEFORE — Post type selector was 3 labeled grid buttons
<div className="grid grid-cols-3 gap-2 sm:gap-3">
  <button className="... rounded-xl px-2 py-2.5 ..."><TypeIcon /> Text</button>
  <button className="..."><ImageIcon /> Media</button>
  <button className="..."><BarChart2 /> Poll</button>
</div>

// AFTER — Bottom toolbar with icon-only circle buttons
<div className="flex items-center justify-between border border-border rounded-xl px-4 py-2.5 mb-4 shadow-sm bg-muted/30">
  <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">Add to your post</span>
  <div className="flex items-center gap-1 sm:gap-2">
    <button className="p-2 rounded-full ... text-emerald-500"><ImageIcon size={20} /></button>
    <button className="p-2 rounded-full ... text-blue-500"><VideoIcon size={20} /></button>
    <button className="p-2 rounded-full ... text-amber-500"><BarChart2 size={20} /></button>
  </div>
</div>
```

```tsx
// BEFORE — Submit button
<Button type="submit" variant="default" className="w-full h-11 rounded-xl text-base font-semibold" disabled={...}>
  {isSubmitting ? 'Publishing…' : 'Publish Post'}
</Button>

// AFTER — Rounded pill submit button
<button
  type="submit"
  disabled={isPostDisabled}
  className={`px-6 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 ${
    isPostDisabled ? 'bg-muted text-muted-foreground cursor-not-allowed'
      : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg active:scale-95'
  }`}
>
  {isSubmitting ? 'Publishing…' : 'Post'}
</button>
```

---

## Change 4: UserAvatar Reusable Component

### Prompt / Intent
Create a single reusable avatar component that handles: image loading, proxy URL generation, error fallback, and deterministic color gradients for initials fallback. Replace all 6+ locations where avatar rendering was done inline.

### New File: `src/components/ui/UserAvatar.tsx` (89 lines)

**Full source:**

```tsx
"use client";

import { useState } from 'react';
import Image from 'next/image';
import { toProxyUrl } from '@/utils/imageUtils';

// Deterministic color from a string — gives each user a unique gradient
function hashColor(str: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors: [string, string][] = [
    ['from-violet-500/30', 'to-purple-500/20'],
    ['from-blue-500/30', 'to-cyan-500/20'],
    ['from-emerald-500/30', 'to-teal-500/20'],
    ['from-amber-500/30', 'to-orange-500/20'],
    ['from-rose-500/30', 'to-pink-500/20'],
    ['from-indigo-500/30', 'to-blue-500/20'],
    ['from-teal-500/30', 'to-green-500/20'],
    ['from-fuchsia-500/30', 'to-pink-500/20'],
  ];
  return colors[Math.abs(hash) % colors.length];
}

type UserAvatarProps = {
  src?: string | null;
  alt?: string;
  fallbackText?: string;
  size?: number;
  className?: string;
  fallbackClassName?: string;
  quality?: number;
};

export function UserAvatar({
  src, alt = 'User', fallbackText, size = 40,
  className = '', fallbackClassName = '', quality = 82,
}: UserAvatarProps) {
  const [failed, setFailed] = useState(false);

  const initial = (fallbackText || alt || 'U').charAt(0).toUpperCase();
  const [g1, g2] = hashColor(fallbackText || alt || 'U');

  const textSize =
    size <= 24 ? 'text-[10px]' :
    size <= 32 ? 'text-xs' :
    size <= 40 ? 'text-sm' :
    size <= 56 ? 'text-lg' :
    'text-xl';

  const proxied = src ? toProxyUrl(src, { width: size * 2, quality }) : '';

  if (!src || failed || !proxied) {
    return (
      <div
        className={`rounded-full bg-gradient-to-br ${g1} ${g2} flex items-center justify-center font-bold text-primary flex-shrink-0 ${fallbackClassName} ${className}`}
        style={{ width: size, height: size }}
        aria-label={alt}
      >
        <span className={textSize}>{initial}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-full overflow-hidden flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <Image
        src={proxied}
        alt={alt}
        width={size}
        height={size}
        className="w-full h-full object-cover"
        unoptimized
        onError={() => setFailed(true)}
      />
    </div>
  );
}
```

### Locations where `UserAvatar` replaced inline avatar code:

| File | Before (lines of code) | After |
|------|----------------------|-------|
| `Sidebar.tsx` — profile card | ~15 lines inline Image+fallback | `<UserAvatar ... size={40} />` |
| `MobileNavBar.tsx` — profile tab | ~15 lines inline Image+fill+fallback | `<UserAvatar ... size={24} />` |
| `CreatePostInput.tsx` — author avatar | ~8 lines AvatarImageWithFallback | `<UserAvatar ... size={44} />` |
| `DashboardSidebarWidgets.tsx` — community avatars | ~12 lines per instance | `<UserAvatar ... size={32} />` |
| `DashboardSidebarWidgets.tsx` — people suggestions | ~12 lines per instance | `<UserAvatar ... size={36} />` |
| `FeedSuggestions.tsx` — suggested users | ~15 lines with inline onError DOM hack | `<UserAvatar ... size={48} />` |
| `TrendingPosts.tsx` — post author | ~10 lines img+fallback | `<UserAvatar ... size={32} />` |
| `page.tsx` — home feed prompt | New usage | `<UserAvatar ... size={36} />` |

---

## Change 5: Dashboard Sidebar Widgets Cleanup

### Prompt / Intent
Simplify the right sidebar widgets. Remove the "Recent Chats" widget (messages now has a dedicated nav item) and the "My Posts Performance" widget (was noisy and not very useful).

### File Modified: `src/components/layout/DashboardSidebarWidgets.tsx`

**What changed:**
- Removed `TrendingUp` icon import (no longer needed after removing My Posts widget)
- Added `UserAvatar` import
- **Removed "Recent Chats" widget** (~50 lines) — showed last conversations with avatars, unread badges, and last message preview. No longer needed since Messages is now in the main nav.
- **Removed "My Posts Performance" widget** (~40 lines) — showed user's recent posts with like/comment counts. Was considered noise.
- Replaced inline avatar rendering in "Communities" and "People to Connect" widgets with `<UserAvatar>`.
- Remaining widgets: Communities, Recent Activity (notifications), People to Connect

---

## Change 6: Startup Onboarding Wizard — 8-Step Redesign

### Prompt / Intent
Redesign the startup creation wizard from a 5-step (+ preview) flow to an 8-step flow. The old flow was: Identity → Stage → Details → Team → Funding → Preview. The new flow is: Identity → Description → Branding → Positioning → Edge → Financials → Media → Visibility. Steps 3–7 (Branding through Media) are optional and can be skipped. Remove the Preview step entirely — replace it with a Visibility & Confirmation step.

### File Modified: `src/components/startups/StartupCreateWizard.tsx`

**Key changes:**
- Steps changed from `['Identity', 'Stage', 'Details', 'Team', 'Funding', 'Preview']` to `['Identity', 'Description', 'Branding', 'Positioning', 'Edge', 'Financials', 'Media', 'Visibility']`
- Added `OPTIONAL_STEPS = [2, 3, 4, 5, 6]` — these steps show a "Skip" button
- Profile data state expanded with 15+ new fields: `city`, `country`, `business_model`, `categories`, `team_size`, `key_strengths`, `target_audience`, `revenue_amount`, `revenue_currency`, `revenue_growth`, `traction_metrics`, `total_raised`, `investor_count`, `elevator_pitch`, `logo_url`, `banner_url`, `visibility`, `confirmation`
- Founders initialized with one empty entry instead of empty array
- Removed `incubators` and `awards` state arrays
- Added `handleLogoUpload` and `handleBannerUpload` functions
- Validation:
  - Step 0 (Identity): requires `brand_name`, `legal_status`, `startup_email`, `stage`
  - Step 1 (Description): requires `description` and at least one founder name
  - Step 7 (Visibility): requires `confirmation` checkbox
  - Steps 2–6: always valid (optional)
- Submit: checks `confirmation`, determines `is_published` from `visibility !== 'private'`
- Removed "Save Draft" + "Publish" dual buttons — replaced with single "Submit" button
- Added mobile-friendly progress: step labels hidden on small screens, replaced with "Step X of Y" + percentage
- New step imports replace old step imports

```tsx
// BEFORE — Step imports
import { Step1BasicIdentity } from './Step1BasicIdentity';
import { Step2CurrentStage } from './Step2CurrentStage';
import { Step3ProfileDetails } from './Step3ProfileDetails';
import { Step4Team } from './Step4Team';
import { Step5FundingRecognition } from './Step5FundingRecognition';
import { StartupPreview } from './StartupPreview';

// AFTER — Step imports
import { Step1Identity } from './Step1Identity';
import { Step2Description } from './Step2Description';
import { Step3Branding } from './Step3Branding';
import { Step4Positioning } from './Step4Positioning';
import { Step5Edge } from './Step5Edge';
import { Step6Financials } from './Step6Financials';
import { Step7Media } from './Step7Media';
import { Step8Visibility } from './Step8Visibility';
```

```tsx
// NEW — Skip button for optional steps
{OPTIONAL_STEPS.includes(step) && (
  <button
    onClick={() => setStep(s => s + 1)}
    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-muted-foreground ..."
  >
    <SkipForward className="h-4 w-4" /> Skip
  </button>
)}
```

### New File: `src/components/startups/Step1Identity.tsx` (212 lines)
**Replaces:** `Step1BasicIdentity.tsx` (103 lines)

Fields: Brand Name*, Registered/Legal Name, Legal Structure* (2x2 grid buttons), CIN/LLPIN (conditional on LLP/Pvt Ltd), Year Founded, City, Country, Startup Email*, Business Model (dropdown: SaaS/Marketplace/D2C/B2B/B2C/Hardware/Subscription/Freemium/Platform/Agency/Other), Current Stage* (chip buttons: Ideation/MVP/Scaling/Expansion/Maturity)

New compared to old: City, Country, Business Model, Startup Email moved here (was in Step3 before)

### New File: `src/components/startups/Step2Description.tsx` (114 lines)
**Replaces parts of:** `Step3ProfileDetails.tsx` + `Step4Team.tsx`

Fields: Product/Service Description* (textarea with char counter), Founders* (dynamic list with name + LinkedIn URL + add/remove)

Combines the description (was in Step3) and founders (was in Step4) into one step.

### New File: `src/components/startups/Step3Branding.tsx` (127 lines)
**Entirely new step**

Fields: Logo Upload (128x128 image preview, drag-to-upload button, remove button), Banner Image Upload (full-width 160px tall preview, upload/remove)

Uses `useRef` for hidden file inputs, communicates via `onLogoUpload`/`onBannerUpload`/`onRemoveLogo`/`onRemoveBanner` callbacks.

### New File: `src/components/startups/Step4Positioning.tsx` (163 lines)
**Entirely new step**

Fields: Industry/Category (multi-select chip buttons from 19 preset categories), Website URL, Team Size (chip buttons: Solo Founder/2-5/6-20/21-50/50+), Keywords/Tags (text input + Enter to add, removable chips)

### New File: `src/components/startups/Step5Edge.tsx` (51 lines)
**Entirely new step**

Fields: Key Strengths / USP (textarea), Target Audience (textarea)

### New File: `src/components/startups/Step6Financials.tsx` (215 lines)
**Replaces parts of:** `Step5FundingRecognition.tsx` (217 lines)

Fields: Revenue section (Amount Monthly, Currency dropdown, MoM Growth), Traction Metrics (textarea), Funding Overview (Total Raised, Number of Investors), Actively Raising toggle, Funding Rounds (dynamic list with round type dropdown, amount, investor, date)

Removed: Incubators section, Awards section (were in old Step5FundingRecognition)

### New File: `src/components/startups/Step7Media.tsx` (93 lines)
**Replaces parts of:** `Step3ProfileDetails.tsx`

Fields: Pitch Deck PDF upload (with status indicator), Elevator Pitch (textarea with char counter)

### New File: `src/components/startups/Step8Visibility.tsx` (100 lines)
**Replaces:** `StartupPreview.tsx` (172 lines)

Fields: Visibility selection (Public / Investors Only / Private — radio-style cards with icons and descriptions), Confirmation checkbox ("I confirm that all information provided is accurate...")

---

## Change 7: Database Migration — New Startup Columns

### New File: `supabase/migrations/003_startup_onboarding_columns.sql`

Adds 16 new columns to `startup_profiles` table:

```sql
ALTER TABLE public.startup_profiles
  ADD COLUMN IF NOT EXISTS business_model text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS categories text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS team_size text,
  ADD COLUMN IF NOT EXISTS key_strengths text,
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS revenue_amount text,
  ADD COLUMN IF NOT EXISTS revenue_currency text DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS revenue_growth text,
  ADD COLUMN IF NOT EXISTS traction_metrics text,
  ADD COLUMN IF NOT EXISTS total_raised text,
  ADD COLUMN IF NOT EXISTS investor_count integer,
  ADD COLUMN IF NOT EXISTS elevator_pitch text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS banner_url text;
```

---

## Change 8: Startup API Enhancements

### File Modified: `src/api/startups.ts`

**What changed:**

1. **`StartupProfile` type** — Added 16 new fields to match the migration:
```tsx
// New fields added to StartupProfile type
is_featured: boolean;
business_model: string | null;
city: string | null;
country: string | null;
categories: string[];
team_size: string | null;
key_strengths: string | null;
target_audience: string | null;
revenue_amount: string | null;
revenue_currency: string | null;
revenue_growth: string | null;
traction_metrics: string | null;
total_raised: string | null;
investor_count: number | null;
elevator_pitch: string | null;
logo_url: string | null;
banner_url: string | null;
```

2. **New function `uploadStartupImage`** — Uploads logo or banner images to Supabase storage:
```tsx
export async function uploadStartupImage(file: File, type: 'logo' | 'banner'): Promise<{ url: string; error?: string }> {
  try {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('User not authenticated');

    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `startup-images/${userId}/${type}/${fileName}`;

    const { error: storageError } = await supabase.storage
      .from('media')
      .upload(filePath, file, { contentType: file.type, upsert: true });

    if (storageError) throw storageError;

    const { data: publicUrlData } = supabase.storage
      .from('media')
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl };
  } catch (error) {
    console.error(`Error uploading startup ${type}:`, error);
    return { url: '', error: error instanceof Error ? error.message : `Failed to upload ${type}` };
  }
}
```

---

## Change 9: Startup Edit Page Update

### File Modified: `src/app/startups/[id]/edit/page.tsx`

**What changed:**
- Updated imports to use new step components (`Step1Identity`, `Step2Description`, `Step3Branding`, etc.) instead of old ones
- Added `uploadStartupImage` import
- Added `isUploadingLogo` and `isUploadingBanner` state
- Added `handleLogoUpload` and `handleBannerUpload` functions
- Profile data state extended with all 16 new fields
- Data loading (`useEffect`) now populates the new fields from the fetched startup
- `handleSave` now includes all new fields in the `updateStartup` call
- Removed `incubators`/`awards` state and their `upsertIncubators`/`upsertAwards` save calls
- UI now renders the 7 new step components (Step1 through Step7, no Step8 on edit since that's publish-only) separated by gradient dividers

---

## Change 10: Housekeeping

### New File: `.env.example`
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Modified: `.gitignore`
- Added `!.env.example` exception so the example env file is tracked
- Added `personal documentation/` to ignore personal docs folder
- Fixed missing trailing newline

### New File: `ux1.md` (534 lines)
Full UX and user flow documentation covering: navigation structure (desktop sidebar, mobile bottom nav, header), page routes, core user flows (signup, posting, messaging, startup onboarding), feature breakdowns, layout architecture, API routes, and responsive design breakpoints. Contains ASCII diagram mockups of every navigation element.

---

## Deleted Files

| File | Lines | Reason |
|------|-------|--------|
| `src/components/startups/Step1BasicIdentity.tsx` | 103 | Replaced by `Step1Identity.tsx` with expanded fields |
| `src/components/startups/Step2CurrentStage.tsx` | 63 | Stage selection moved into `Step1Identity.tsx` |
| `src/components/startups/Step3ProfileDetails.tsx` | 209 | Split into `Step2Description.tsx` (description), `Step1Identity.tsx` (email/phone), `Step7Media.tsx` (pitch deck) |
| `src/components/startups/Step4Team.tsx` | 96 | Founders moved into `Step2Description.tsx` |
| `src/components/startups/Step5FundingRecognition.tsx` | 217 | Replaced by `Step6Financials.tsx` (funding + revenue), removed incubators/awards sections |
| `src/components/startups/StartupPreview.tsx` | 172 | Replaced by `Step8Visibility.tsx` (confirmation + visibility) |

**Total deleted:** 860 lines across 6 files

---

## New Files

| File | Lines | Purpose |
|------|-------|---------|
| `src/components/ui/UserAvatar.tsx` | 89 | Reusable avatar with gradient fallback |
| `src/components/startups/Step1Identity.tsx` | 212 | Step 1: Startup identity (brand, legal, location, email, stage) |
| `src/components/startups/Step2Description.tsx` | 114 | Step 2: Description + founders |
| `src/components/startups/Step3Branding.tsx` | 127 | Step 3: Logo + banner upload (optional) |
| `src/components/startups/Step4Positioning.tsx` | 163 | Step 4: Categories, website, team size, keywords (optional) |
| `src/components/startups/Step5Edge.tsx` | 51 | Step 5: Key strengths + target audience (optional) |
| `src/components/startups/Step6Financials.tsx` | 215 | Step 6: Revenue, traction, funding rounds (optional) |
| `src/components/startups/Step7Media.tsx` | 93 | Step 7: Pitch deck + elevator pitch (optional) |
| `src/components/startups/Step8Visibility.tsx` | 100 | Step 8: Visibility settings + confirmation |
| `supabase/migrations/003_startup_onboarding_columns.sql` | 19 | DB migration for 16 new columns |
| `.env.example` | 4 | Environment variable template |
| `ux1.md` | 534 | UX documentation |

**Total new:** ~1,721 lines across 12 files
