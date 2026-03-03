# Poll Voting Bug Fix Plan

## Problem Summary

A user can appear voted on multiple options in a **single_choice** poll. The screenshot
shows Ashish kushwaha with votes on both "45" and "5656" — impossible by design.

---

## Root Cause Analysis

### Bug 1 — Server: stale `!inner` join filter in `votePollOption` ✅ FIXED
**File:** `src/api/posts.ts` · `votePollOption()` · Step 4

The query that removes a user's existing vote before casting a new single_choice vote used
PostgREST `!inner` join filtering:

```ts
// BROKEN — filter on joined table silently returns empty in some Supabase environments
.select('id, poll_option_id, post_poll_options!inner(poll_id)')
.eq('user_id', userId)
.eq('post_poll_options.poll_id', pollId)   // ← unreliable
```

When this returned `[]` despite an existing vote, the old vote was not deleted before the
new INSERT, leaving the user with two votes in the same single_choice poll.

**Fix already applied:** replaced with a two-step query —
1. `SELECT id FROM post_poll_options WHERE poll_id = ?`
2. `SELECT id, poll_option_id FROM post_poll_votes WHERE user_id = ? AND poll_option_id IN (...)`

---

### Bug 2 — Server: same `!inner` join bug in `checkUserPollVotes` ❌ NOT FIXED
**File:** `src/api/posts.ts` · `checkUserPollVotes()` · line ~874

```ts
// BROKEN — same unreliable filter
.select(`id, poll_option_id, user_id, created_at, post_poll_options!inner(id, option_text, poll_id)`)
.eq('user_id', userId)
.eq('post_poll_options.poll_id', pollId)   // ← unreliable
```

**Impact:** On page load the component calls `checkUserPollVotes` to restore
`userVotedOptions`. If the query returns empty, the UI shows no selected option even
though the user already voted. Users then click "again" — which triggers another vote
(the DB-level story becomes Bug 1 all over again).

**Fix needed:** Same two-step approach as Bug 1 — fetch option IDs for the poll first,
then use `.in('poll_option_id', optionIds)`.

---

### Bug 3 — Database: no single_choice uniqueness constraint ❌ NOT FIXED
**Tables:** `post_poll_votes`, `post_polls`, `post_poll_options`

No migration file defines a unique constraint that prevents a single user from holding
multiple votes in a single_choice poll. The application code is the only enforcement
layer. If code has a bug (Bugs 1 & 2), duplicate rows are created silently.

**Fix needed:** Two Supabase migration steps:

```sql
-- 1. Unique constraint per option (prevents voting the same option twice)
ALTER TABLE post_poll_votes
  ADD CONSTRAINT uq_vote_user_option UNIQUE (user_id, poll_option_id);

-- 2. Function + trigger to enforce single_choice at the DB level
CREATE OR REPLACE FUNCTION enforce_single_choice_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_poll_type TEXT;
BEGIN
  SELECT pp.poll_type INTO v_poll_type
  FROM post_poll_options ppo
  JOIN post_polls pp ON pp.id = ppo.poll_id
  WHERE ppo.id = NEW.poll_option_id;

  IF v_poll_type = 'single_choice' THEN
    -- Delete any pre-existing vote by this user in the same poll
    DELETE FROM post_poll_votes
    WHERE user_id = NEW.user_id
      AND poll_option_id IN (
        SELECT id FROM post_poll_options
        WHERE poll_id = (
          SELECT poll_id FROM post_poll_options WHERE id = NEW.poll_option_id
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_choice
BEFORE INSERT ON post_poll_votes
FOR EACH ROW EXECUTE FUNCTION enforce_single_choice_vote();
```

This makes the DB the final safety net regardless of application-layer bugs.

---

### Bug 4 — Client: stale closure in `handlePollVote` server-sync path ⚠️ MINOR
**File:** `src/components/posts/PostCard.tsx` · `handlePollVote()` · lines 884–892

After a successful vote, the code rebuilds `serverUserVotes` from the stale closure
snapshot `pollState.userVotedOptions` instead of the live state:

```ts
// Both branches read the stale snapshot
if (data.action === 'removed') {
  serverUserVotes = pollState.userVotedOptions.filter(id => id !== optionId);
} else if (post.poll?.poll_type === 'multiple_choice') {
  serverUserVotes = [...new Set([...pollState.userVotedOptions.filter(...), optionId])];
}
```

For single_choice polls the result is always `[optionId]` so this path is harmless today,
but for multiple_choice it can re-add an option that was already removed if the state has
drifted.

**Fix needed:** Replace the closure reads with a functional setState update that reads
current state, or (simpler) always derive `serverUserVotes` from the server-returned
option list rather than the local snapshot.

---

## Fix Checklist

| # | Layer    | File / Location                                         | Status      |
|---|----------|---------------------------------------------------------|-------------|
| 1 | Server   | `posts.ts` · `votePollOption()` · Step 4 join query     | ✅ Done      |
| 2 | Server   | `posts.ts` · `checkUserPollVotes()` · join query        | ❌ Pending  |
| 3 | Database | New migration: `uq_vote_user_option` constraint         | ❌ Pending  |
| 3 | Database | New migration: `trg_enforce_single_choice` trigger      | ❌ Pending  |
| 4 | Client   | `PostCard.tsx` · `handlePollVote()` stale closure       | ⚠️ Low pri  |

---

## Implementation Order

**Step 1 — Fix `checkUserPollVotes` (Bug 2)**

Same two-step pattern as the already-applied Bug 1 fix.

```ts
// src/api/posts.ts — checkUserPollVotes()
// Replace the !inner join query with:

const { data: pollOptions } = await supabase
  .from('post_poll_options')
  .select('id')
  .eq('poll_id', pollId);

if (!pollOptions || pollOptions.length === 0) {
  return { votes: [], error: null };
}

const pollOptionIds = pollOptions.map((o: { id: string }) => o.id);

const { data, error } = await supabase
  .from('post_poll_votes')
  .select('id, poll_option_id, user_id, created_at')
  .eq('user_id', userId)
  .in('poll_option_id', pollOptionIds);
```

**Step 2 — Add DB migration (Bug 3)**

Create `supabase/migrations/004_poll_vote_constraints.sql` with the SQL from Bug 3 above.
Run via `supabase db push` or apply directly in the Supabase dashboard SQL editor.

Note: before adding `uq_vote_user_option`, clean up any existing duplicate rows:
```sql
-- Remove duplicate votes keeping the earliest one
DELETE FROM post_poll_votes
WHERE id NOT IN (
  SELECT MIN(id) FROM post_poll_votes
  GROUP BY user_id, poll_option_id
);
```

**Step 3 — Fix stale closure in handlePollVote (Bug 4)**

Low priority. The simplest fix is to read the functional updater pattern in the final
`setPollState` call so `serverUserVotes` is built from the current state rather than the
stale closure.

---

## Testing Scenarios

After all fixes are applied, verify:

1. **Single choice, fresh vote:** Click option A → A is highlighted, count +1.
2. **Single choice, switch vote:** Click option A then B → only B highlighted, A count
   reverts, B count +1.
3. **Single choice, deselect:** Click same option A twice → no option highlighted, count
   reverts.
4. **Multiple choice:** Click A then B → both highlighted, both counts +1.
5. **Page reload after vote:** Reload → previously selected option still highlighted.
6. **Rapid double-click:** Click same option twice quickly → only one request fires
   (isVotingRef guard).
7. **DB direct check:** After switching vote, verify `post_poll_votes` has exactly ONE
   row per user per single_choice poll.
