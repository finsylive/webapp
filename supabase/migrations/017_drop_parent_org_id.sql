-- Drop unused parent_org_id column from startup_profiles
-- This column was reserved for future org hierarchy but never used.
-- If org parenting is needed later, it can be re-added.

ALTER TABLE startup_profiles DROP COLUMN IF EXISTS parent_org_id;
