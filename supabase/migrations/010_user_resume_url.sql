-- Migration: Add resume_url to users table for CV/resume storage
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS resume_url TEXT;
