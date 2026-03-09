# UI/UX Audit Report — Ments Webapp

**Date:** 2026-03-09
**Scope:** Full codebase review — 70+ components, 40+ routes, global styles
**Findings:** 50+ distinct UI issues across 10 categories

---

## Executive Summary

This audit identifies UI patterns and implementation gaps that degrade user experience across the Ments webapp. The most critical areas are **missing feedback mechanisms** (users don't know if actions succeeded or failed), **mobile responsiveness gaps** (broken layouts on phones), and **accessibility deficiencies** (excluding users with disabilities or on assistive technology).

---

## Priority Matrix

| Priority | Category | Issue Count | User Impact |
|----------|----------|-------------|-------------|
| **P0** | Missing error/success feedback | 8 | Users don't know if actions worked |
| **P0** | Mobile overflow/positioning | 6 | Broken UI on phones |
| **P1** | Touch targets & text size | 4 | Unusable for many mobile users |
| **P1** | Empty states | 4 | Users think app is broken |
| **P1** | Accessibility (labels, focus) | 7 | Excludes users with disabilities |
| **P2** | Form validation UX | 5 | Confusing forms, lost input |
| **P2** | Navigation gaps on mobile | 5 | Features unreachable |
| **P2** | Styling inconsistencies | 4 | Unprofessional feel |
| **P3** | Performance UX | 3 | Sluggish on large data |

---

## 1. Accessibility Issues (Critical)

### 1.1 Touch Targets Below 44x44px

Mobile touch targets must be at least 44x44px per Apple and Android guidelines. Several interactive elements fall short:

| Component | File | Size | Required |
|-----------|------|------|----------|
| Mobile nav icons | `src/components/layout/MobileNavBar.tsx:84` | ~36x36px (`p-2` on 20px icon) | 44x44px |
| Notification button | `src/components/layout/DashboardLayout.tsx:99` | 40x40px (`h-10 w-10`) | 44x44px |
| Sidebar widget links | `src/components/layout/DashboardSidebarWidgets.tsx:139` | `px-2 py-[7px]` — tight | 44x44px |

**Impact:** Users frequently misclick, especially on smaller phones. Frustrating for users with motor impairments.

### 1.2 Text Below Readable Minimum

| Component | File | Size | Minimum |
|-----------|------|------|---------|
| Mobile nav labels | `src/components/layout/MobileNavBar.tsx:87` | 11px (`text-[11px]`) | 12px |

**Impact:** Unreadable for users with poor vision or on older/smaller phones.

### 1.3 Missing Form Labels

| Component | File | Issue |
|-----------|------|-------|
| Skills input | `src/components/profile/EditProfileForm.tsx:148-165` | Has placeholder only, no `<label>` element |
| Message input | `src/components/chat/MessageInput.tsx:31` | Placeholder with no visible label |

**Impact:** Screen readers cannot identify form fields. WCAG 2.1 Level A violation.

### 1.4 Keyboard Navigation Gaps

| Component | File | Issue |
|-----------|------|-------|
| Feed suggestion scroll buttons | `src/components/feed/FeedSuggestions.tsx:84-90` | No tab order management |
| Post card media scroll buttons | `src/components/posts/PostCard.tsx:373-391` | No keyboard focus management |

**Impact:** Keyboard-only users cannot scroll horizontal carousels.

### 1.5 Generic Image Alt Text

| Component | File | Current Alt | Better Alt |
|-----------|------|-------------|------------|
| Chat images | `src/components/messages/MessageBubble.tsx:76-81` | `"Shared image"` | Descriptive context or user-provided caption |

### 1.6 No Error Boundaries

No `ErrorBoundary` component wraps any page or feature section. A single render error crashes the entire page with a white screen.

**Recommendation:** Wrap each major page section with an Error Boundary that shows a recovery UI instead of crashing.

---

## 2. Missing Feedback Mechanisms (P0)

This is the highest-impact category. Users perform actions and receive no confirmation of success or failure.

### 2.1 No Loading States

| Component | File | Issue |
|-----------|------|-------|
| Post feed | `src/components/posts/PostList.tsx:18-44` | No skeleton/spinner during initial load |
| Conversation list | `src/components/chat/ConversationList.tsx` | Loads without skeleton placeholders |
| Edit profile form | `src/components/profile/EditProfileForm.tsx` | No skeleton while profile data loads |

**Impact:** Users see blank content and don't know if the app is loading or broken.

### 2.2 Silent Failures — Errors Not Shown to Users

| Component | File | What Happens |
|-----------|------|-------------|
| Location search | `src/components/profile/EditProfileForm.tsx:276-299` | Empty `catch` block — fails silently |
| User search | `src/components/startups/MentsUserSearch.tsx:56` | Errors swallowed, user sees nothing |
| Post actions (like, comment) | `src/components/posts/PostCard.tsx:66-73` | Errors logged to console only |
| Message send | `src/components/chat/MessageInput.tsx:60-62` | Send failure — no user-facing error |

**Impact:** Users think their action worked when it didn't. Data loss, confusion, and repeated failed attempts.

### 2.3 No Success Confirmation

| Component | File | Missing Feedback |
|-----------|------|-----------------|
| Profile save | `src/components/profile/EditProfileForm.tsx` | No success toast after saving |
| Post creation | `src/components/posts/CreatePostForm.tsx` | No confirmation after posting |

**Impact:** Users are unsure if their changes were saved, leading to redundant submissions.

### 2.4 Missing Confirmation Dialogs

| Component | File | Destructive Action Without Confirmation |
|-----------|------|----------------------------------------|
| Delete post | `src/components/posts/PostCard.tsx` | `deletePost` called immediately |
| Resume upload | `src/components/profile/ResumeUpload.tsx` | Overwrites existing resume without asking |

**Impact:** Accidental data loss with no recovery path.

---

## 3. Mobile Responsiveness (P0)

### 3.1 Hardcoded Sizes That Break on Mobile

| File | Value | Issue |
|------|-------|-------|
| `src/components/chat/MessageBubble.tsx:213` | `max-w-[70%]` | On 375px phone = ~260px, too cramped for messages |
| `src/components/messages/EmojiPicker.tsx:134` | `h-96` (384px) | Too tall on phones under 500px height |
| `src/components/posts/MentionDropdown.tsx:106` | `max-w-[350px]` | Nearly fills a 375px viewport (only 25px margin) |
| `src/components/posts/PostCard.tsx:430-433` | 350px/200px/500px | No responsive variants |
| `src/components/feed/FeedSuggestions.tsx:50` | 176px scroll | Hardcoded, doesn't adapt to card width |

### 3.2 Fixed Positioning Collisions

| File | Issue |
|------|-------|
| `src/components/layout/MobileNavBar.tsx:80` | Fixed bottom bar; not all pages add `pb-16` to compensate — content hidden behind nav |
| `src/components/ui/FloatingActionButton.tsx:21` | `bottom-20` may overlap mobile nav bar at `bottom-0` |
| `src/components/posts/CreatePostInput.tsx:154` | Absolute `bottom-6 right-6` button can collide with mobile nav |

### 3.3 Overflow / Off-Screen Content

| File | Issue |
|------|-------|
| `src/components/posts/MentionDropdown.tsx:106` | Fixed position with no viewport boundary check — dropdown goes off-screen |
| `src/components/chat/MessageBubble.tsx:222` | Action buttons at `-left-20` / `-right-20` overflow on narrow screens |
| `src/app/globals.css:247-251` | `word-break: break-all` breaks URLs and emails mid-word |

### 3.4 Missing Responsive Breakpoints

| File | Issue |
|------|-------|
| `src/components/layout/DashboardLayout.tsx:127` | Only `md:` breakpoint for sidebar — no `sm:` for tablets (640-768px) |
| `src/components/layout/ChatLayout.tsx:214` | Harsh width transition: `w-full` -> `md:w-80` at 768px |
| `src/components/auth/LoginPromptModal.tsx:50` | `p-6` padding on 320px device = only 272px usable — needs `p-4 sm:p-6` |

---

## 4. Empty States (P1)

When lists or feeds have no data, users see blank sections and assume the app is broken.

| Component | File | Current Behavior | Expected |
|-----------|------|-----------------|----------|
| Post feed | `src/components/posts/PostList.tsx` | Returns `null` — blank page | "No posts yet" with CTA |
| Feed suggestions | `src/components/feed/FeedSuggestions.tsx:54` | Returns `null` | "No suggestions right now" |
| Conversation list (filtered) | `src/components/chat/ConversationList.tsx` | Shows nothing | "No conversations match this filter" |
| User search results | `src/components/startups/MentsUserSearch.tsx` | No message | "No users found" |

**Recommendation:** Create a reusable `<EmptyState />` component with icon, message, and optional CTA button.

---

## 5. Form UX Issues (P2)

### 5.1 Validation Problems

| Issue | File |
|-------|------|
| No inline validation errors on skills input | `src/components/profile/EditProfileForm.tsx:149-165` |
| No validation before post submit | `src/components/posts/CreatePostForm.tsx:217-227` |
| Browser `alert()` for file size error | `src/components/chat/MessageInput.tsx:82-90` |
| File errors in state but no inline UI | `src/components/profile/ResumeUpload.tsx:89-97` |

### 5.2 Button State Issues

| Issue | File |
|-------|------|
| Poll add/remove buttons clickable at limit | `src/components/posts/CreatePostForm.tsx:113-126` |
| No back/cancel button on edit forms | `src/components/profile/EditProfileForm.tsx` |
| Sign out button shows text change but doesn't disable | `src/components/layout/Sidebar.tsx:235-256` |

---

## 6. Navigation Inconsistencies (P2)

### 6.1 Mobile Navigation Gaps

| Issue | Details |
|-------|---------|
| **No hamburger menu** | Sidebar is `hidden md:block` (`DashboardLayout.tsx:126`). Mobile users only get 4 links via bottom nav — many features are unreachable. |
| **No breadcrumbs** | Deep routes like `/profile/[username]/education/[id]/edit` have no navigation context. |
| **No back button in mobile chat** | `ChatLayout.tsx:214` — conversation list hidden when viewing a message, no explicit back. |

### 6.2 Visual Inconsistencies Between Mobile and Desktop Nav

| Aspect | Desktop Sidebar | Mobile NavBar |
|--------|----------------|---------------|
| Available links | All pages | Only 4 (Home, Search, Messages, Profile) |
| Text size | `text-[15px]` | `text-[11px]` |
| Spacing | `px-4 py-3.5` | `p-2` |
| Color tokens | `emerald-400` labels | Different styling |

---

## 7. Styling Inconsistencies (P2)

| Issue | Locations |
|-------|-----------|
| Mixed text sizes for same role | MobileNavBar: `text-[11px]`, other nav: `text-xs` (12px), Sidebar: `text-[15px]` |
| Inconsistent spacing | Sidebar nav: `px-4 py-3.5`, Widget links: `px-2 py-[7px]` — same visual role |
| Mixed color tokens | Some components use `text-emerald-400`, others use `bg-green-600` for primary actions |
| `!important` override | `globals.css:185-195` — `.message-bubble { max-width: 85% !important }` |

**Recommendation:** Establish and enforce a design token system. All components should reference `primary`, `secondary`, etc. from the theme — not raw Tailwind color classes.

---

## 8. Performance-Related UX (P3)

| Issue | File | Impact |
|-------|------|--------|
| No image lazy loading in chat | `src/components/chat/MessageBubble.tsx` | Long conversations load all images eagerly |
| No list virtualization | `src/components/posts/PostList.tsx` | All posts rendered — degrades with large feeds |
| Numeric upload progress only | `src/components/chat/MessageInput.tsx:33-34` | No visual progress bar |

---

## Recommendations Summary

### Immediate (P0) — Fix This Week

1. **Add a toast/notification system** (e.g., `sonner` or `react-hot-toast`). This resolves all 8 missing feedback issues in one integration.
2. **Add confirmation dialogs** before destructive actions (delete post, overwrite resume).
3. **Fix mobile overflow** — add viewport boundary detection to `MentionDropdown`, emoji picker, and message action buttons.
4. **Ensure consistent `pb-16`** on all pages using `MobileNavBar` to prevent content hidden behind nav.

### Short-term (P1) — Fix This Sprint

5. **Implement empty states** with illustrations and CTAs for every list/feed component. Create a reusable `<EmptyState />` component.
6. **Increase all touch targets** to minimum 44x44px.
7. **Increase mobile nav text** from 11px to at least 12px.
8. **Add Error Boundaries** wrapping each major page section.
9. **Add `<label>` elements** to all form inputs for screen reader accessibility.

### Medium-term (P2) — Next 2 Sprints

10. **Add a hamburger menu** or expandable mobile nav to expose all sidebar links on mobile.
11. **Add breadcrumb navigation** for deeply nested profile/education/experience routes.
12. **Standardize color tokens** — replace raw Tailwind colors (`emerald-400`, `green-600`) with theme variables (`primary`, `accent`).
13. **Replace browser `alert()`** with inline error messages in forms.
14. **Add skeleton loading** to all data-fetching components.

### Long-term (P3) — Backlog

15. **Add list virtualization** for post feeds and conversation lists.
16. **Implement lazy loading** for images in chat/message threads.
17. **Add visual progress bars** for file uploads.

---

## Appendix: Files Most Frequently Cited

| File | Issues | Categories |
|------|--------|------------|
| `src/components/layout/MobileNavBar.tsx` | 4 | Accessibility, Touch Targets, Text Size, Navigation |
| `src/components/profile/EditProfileForm.tsx` | 6 | Forms, Feedback, Accessibility, Loading |
| `src/components/posts/PostCard.tsx` | 4 | Responsiveness, Accessibility, Feedback |
| `src/components/chat/MessageBubble.tsx` | 4 | Responsiveness, Overflow, Accessibility |
| `src/components/posts/MentionDropdown.tsx` | 2 | Overflow, Responsiveness |
| `src/components/layout/DashboardLayout.tsx` | 3 | Responsiveness, Touch Targets, Navigation |
| `src/components/chat/MessageInput.tsx` | 3 | Forms, Feedback, Performance |
| `src/app/globals.css` | 2 | Overflow, Styling |
