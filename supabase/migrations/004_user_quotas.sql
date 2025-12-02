-- User Quotas Table
-- Only stores custom total_quota limits for users
-- Used count is calculated from generations table
CREATE TABLE IF NOT EXISTS user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  total_quota INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);

-- Enable Row Level Security
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_quotas
-- Users can view their own quota
CREATE POLICY "Users can view their own quota" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policy - admins can view and update all quotas
-- Service role bypasses RLS automatically

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_quotas updated_at
DROP TRIGGER IF EXISTS update_user_quotas_updated_at ON user_quotas;
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_user_quotas_updated_at();

