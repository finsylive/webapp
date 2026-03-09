-- ============================================================
-- Migration: Fix soft_delete_user email hash collision
-- Problem: If a user deletes, re-registers, and deletes again,
--          sha256(email) produces the same hash, causing a
--          unique constraint violation on users.email.
-- Fix: Include the user's UUID in the hash so it's always unique.
--       Also clean up any orphaned deleted rows before hashing.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_user(
    p_user_id uuid,
    p_reason text DEFAULT 'User requested permanent deletion'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_original_email text;
    v_hashed_email text;
    v_deleted_username text;
BEGIN
    -- Verify the user exists and is not already deleted
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id AND account_status <> 'deleted'
    ) THEN
        RAISE EXCEPTION 'User not found or already deleted';
    END IF;

    -- Get the original email
    SELECT email INTO v_original_email
    FROM public.users
    WHERE id = p_user_id;

    -- Hash email + user ID to guarantee uniqueness across re-deletions
    v_hashed_email := encode(
        extensions.digest(v_original_email || '::' || p_user_id::text, 'sha256'),
        'hex'
    );

    -- Clean up any old deleted rows that might have a colliding email hash
    -- (from previous deletion cycles of the same user or edge cases)
    DELETE FROM public.users
    WHERE email = v_hashed_email
      AND id <> p_user_id
      AND account_status = 'deleted';

    -- Generate a unique deleted username to free the original
    v_deleted_username := 'deleted_' || left(p_user_id::text, 8);

    -- Scrub PII and update account status
    UPDATE public.users
    SET
        account_status   = 'deleted',
        status_reason    = p_reason,
        status_changed_at = now(),
        status_changed_by = p_user_id,
        email            = v_hashed_email,
        username         = v_deleted_username,
        full_name        = 'Deleted User',
        about            = NULL,
        current_city     = NULL,
        tagline          = NULL,
        avatar_url       = NULL,
        banner_image     = NULL,
        fcm_token        = NULL,
        linkedin         = NULL,
        skills           = '{}',
        looking_for      = '{}',
        is_verified      = false,
        primary_interest = 'exploring',
        investor_status  = 'none',
        investor_verified_at = NULL
    WHERE id = p_user_id;

    -- Hard-delete all messages sent by this user
    DELETE FROM public.messages
    WHERE sender_id = p_user_id;

    -- Hard-delete conversations where user is a participant
    DELETE FROM public.conversations
    WHERE user1_id = p_user_id OR user2_id = p_user_id;

    RETURN true;
END;
$$;
