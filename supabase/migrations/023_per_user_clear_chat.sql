-- Add per-user cleared_at timestamps to conversations
-- When a user clears a chat, only their view is cleared (messages remain for the other user)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS user1_cleared_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user2_cleared_at TIMESTAMPTZ DEFAULT NULL;
