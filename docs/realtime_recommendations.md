# Realtime API Recommendations

> Which APIs should use Supabase Realtime subscriptions for better UX.

---

## Current Realtime Status

| Feature | Status | Implementation |
|---------|--------|----------------|
| New messages in chat | Implemented | `useRealtimeMessages.ts` — postgres_changes on `messages` |
| Typing indicators | Implemented | Supabase broadcast channel |
| Feed new post injection | Partial | Polling-based injection via `realtime-injector.ts` |
| Everything else | Not realtime | Fetch on mount / manual refresh |

---

## HIGH PRIORITY — Biggest UX Impact

### 1. Notifications (Real-time badge)

**Problem:** Notification bell badge only updates on page load. Users miss timely alerts.

| Detail | Value |
|--------|-------|
| Table | `inapp_notification` |
| Event | `INSERT` |
| API Route | `GET /api/notifications` (HEAD for count) |
| Scope | Filter by `user_id = auth.uid()` |

**Implementation:**
```ts
supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'inapp_notification',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    // Increment unread badge count
    // Optionally show toast
  })
  .subscribe();
```

**Impact:** Users see notifications instantly — critical for mentions, replies, follows, founder invites.

---

### 2. Message Reactions

**Problem:** Reactions on messages only appear after reopening the chat. In a live conversation this feels broken.

| Detail | Value |
|--------|-------|
| Table | `message_reactions` |
| Events | `INSERT`, `DELETE` |
| API Route | `GET/POST/DELETE /api/messages/reactions` |
| Scope | Filter by `conversation_id` (via message join) |

**Implementation:**
```ts
supabase
  .channel(`reactions:${conversationId}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'message_reactions'
  }, (payload) => {
    // Add/remove reaction from message in state
  })
  .subscribe();
```

**Impact:** Reactions feel instant in live conversations.

---

### 3. Conversation List Updates

**Problem:** When a new message arrives, the conversation list sidebar doesn't reorder. Users must refresh to see which chat has new messages.

| Detail | Value |
|--------|-------|
| Table | `conversations` |
| Event | `UPDATE` (last_message_at changes) |
| API Route | `GET /api/conversations` |
| Scope | Filter by `user1_id` or `user2_id = auth.uid()` |

**Implementation:**
```ts
supabase
  .channel('conversations')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'conversations'
  }, (payload) => {
    // Move conversation to top
    // Update last message preview
    // Increment unread count
  })
  .subscribe();
```

**Impact:** Conversations reorder in real-time like Instagram/WhatsApp.

---

### 4. Unread Message Count

**Problem:** The "Messages" nav badge showing unread count doesn't update until page refresh.

| Detail | Value |
|--------|-------|
| Table | `messages` |
| Event | `INSERT` |
| API Route | `GET /api/messages/read` |
| Scope | Filter by recipient user |

**Implementation:** Can piggyback on the conversation list subscription above — when a new message arrives for a conversation the user isn't viewing, increment the global unread count.

**Impact:** Users always know they have unread messages without refreshing.

---

### 5. Post Likes (Live Engagement)

**Problem:** Like counts on posts are stale. If multiple people like a post, the count doesn't update for other viewers.

| Detail | Value |
|--------|-------|
| Table | `post_likes` |
| Events | `INSERT`, `DELETE` |
| API Route | Handled in `PostCard.tsx` via `likePost`/`unlikePost` |
| Scope | Filter by visible post IDs |

**Implementation:**
```ts
supabase
  .channel('post-likes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'post_likes',
    filter: `post_id=in.(${visiblePostIds.join(',')})`
  }, (payload) => {
    // Increment/decrement like count on matching post
  })
  .subscribe();
```

**Impact:** Social proof — users see engagement happening live on posts.

---

## MEDIUM PRIORITY

### 6. Follow/Unfollow Updates

**Problem:** Follower counts on profiles don't update when someone follows/unfollows.

| Detail | Value |
|--------|-------|
| Table | `user_follows` |
| Events | `INSERT`, `DELETE` |
| API Route | `POST /api/users/[username]/follow` |
| Scope | Filter by `followee_id` (the profile being viewed) |

**When to use:** Only on the profile page being viewed. Listen for changes where `followee_id` matches the displayed profile.

**Impact:** Follower counts stay accurate on profile pages.

---

### 7. New Posts in Feed

**Problem:** New posts only appear on manual refresh. Currently uses a polling-based injector.

| Detail | Value |
|--------|-------|
| Table | `posts` |
| Event | `INSERT` |
| API Route | `GET /api/feed` |
| Scope | Global or filtered by followed users/environments |

**Implementation:** Replace the polling injector with a realtime subscription. Show a "New posts available" banner at the top of the feed (like Twitter/X).

```ts
supabase
  .channel('new-posts')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'posts',
    filter: 'parent_post_id=is.null'  // Only top-level posts
  }, () => {
    // Show "New posts" banner, don't auto-insert
  })
  .subscribe();
```

**Impact:** Users know fresh content is available without refreshing.

---

### 8. Post Comments/Replies

**Problem:** Reply counts don't update live. Users viewing a post don't see new replies until refresh.

| Detail | Value |
|--------|-------|
| Table | `posts` (replies are posts with `parent_post_id`) |
| Event | `INSERT` |
| API Route | `GET /api/posts/[postId]/replies` |
| Scope | Filter by `parent_post_id` |

**When to use:** Only on the post detail page. Listen for new replies to the current post.

**Impact:** Comment threads feel alive.

---

### 9. Event Leaderboard (Live)

**Problem:** Event/competition leaderboards are stale — scores don't update in real-time.

| Detail | Value |
|--------|-------|
| Tables | `event_leaderboard`, `event_participants` |
| Events | `INSERT`, `UPDATE` |
| API Route | `GET /api/events/[id]/leaderboard` |
| Scope | Filter by `event_id` |

**Impact:** Live events feel dynamic. Critical during active competitions.

---

## LOW PRIORITY

| Feature | Table | Reason |
|---------|-------|--------|
| Post deletions | `posts` | Rare event, acceptable delay |
| Startup profile updates | `startup_profiles` | Infrequent, low urgency |
| Project updates | `projects` | Profile section, low traffic |
| Block/unblock | `user_blocks` | Rare action |
| Bookmark sync | `post_bookmarks` | Personal action, no cross-user impact |
| Environment/community changes | `environments` | Admin action, very rare |

---

## Implementation Priority Order

```
Phase 1 (Quick wins — high impact, low effort):
  1. Notification badge         — single channel, huge UX win
  2. Message reactions          — extend existing message realtime
  3. Conversation list reorder  — extend existing message infra
  4. Unread message count       — piggyback on #3

Phase 2 (Engagement features):
  5. Post likes live count      — visible social proof
  6. New posts banner           — replaces polling injector
  7. Follow count updates       — profile page enhancement

Phase 3 (Feature-specific):
  8. Live reply threads         — post detail page
  9. Event leaderboards         — during active events only
```

---

## Architecture Notes

- All realtime subscriptions should be created in custom hooks (`useRealtime*`)
- Subscribe on mount, unsubscribe on cleanup
- Use Supabase RLS — realtime respects row-level security policies
- Batch subscriptions where possible (one channel per page, not per component)
- For feed posts, use a "New posts available" banner pattern — never auto-inject to avoid scroll jumps
- Rate limit client-side state updates for high-frequency tables (likes)
