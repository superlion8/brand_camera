-- Add soft delete column to generations table
-- This prevents users from hacking the quota system by deleting generations

ALTER TABLE generations ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
ALTER TABLE generations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for filtering deleted items
CREATE INDEX IF NOT EXISTS idx_generations_is_deleted ON generations(is_deleted);

-- Note: Quota calculation should IGNORE is_deleted flag
-- i.e., deleted generations still count towards quota usage

