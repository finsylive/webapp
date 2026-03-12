-- 023_facilitator_verification_status.sql
-- Add staged verification tracking for startup facilitator profiles.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS verification_details JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_verification_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_verification_status_check
      CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected'));
  END IF;
END $$;

UPDATE public.organizations
SET
  verification_status = 'verified',
  verification_reviewed_at = COALESCE(verification_reviewed_at, now())
WHERE is_verified = true
  AND verification_status <> 'verified';

CREATE INDEX IF NOT EXISTS idx_organizations_verification_status
  ON public.organizations(verification_status);
