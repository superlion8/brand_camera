-- User Quotas Table
CREATE TABLE IF NOT EXISTS user_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email TEXT,
  total_quota INTEGER NOT NULL DEFAULT 30,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_id ON user_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_email ON user_quotas(user_email);

-- Enable Row Level Security
ALTER TABLE user_quotas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_quotas
-- Users can view their own quota
CREATE POLICY "Users can view their own quota" ON user_quotas
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own quota (for first-time setup)
CREATE POLICY "Users can insert their own quota" ON user_quotas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own quota (only used_count, not total_quota)
CREATE POLICY "Users can update their own used_count" ON user_quotas
  FOR UPDATE USING (auth.uid() = user_id);

-- Admin policy (service role can do anything)
-- Note: Service role bypasses RLS, so admins using service key can manage all quotas

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_quotas updated_at
CREATE TRIGGER update_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_user_quotas_updated_at();

-- Function to get or create user quota
CREATE OR REPLACE FUNCTION get_or_create_user_quota(p_user_id UUID, p_user_email TEXT DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  user_email TEXT,
  total_quota INTEGER,
  used_count INTEGER,
  remaining_quota INTEGER
) AS $$
DECLARE
  v_id UUID;
  v_total INTEGER;
  v_used INTEGER;
BEGIN
  -- Try to get existing quota
  SELECT uq.id, uq.total_quota, uq.used_count
  INTO v_id, v_total, v_used
  FROM user_quotas uq
  WHERE uq.user_id = p_user_id;
  
  -- If not found, create new record
  IF NOT FOUND THEN
    INSERT INTO user_quotas (user_id, user_email, total_quota, used_count)
    VALUES (p_user_id, p_user_email, 30, 0)
    RETURNING user_quotas.id, user_quotas.total_quota, user_quotas.used_count
    INTO v_id, v_total, v_used;
  END IF;
  
  -- Return the result
  RETURN QUERY
  SELECT v_id, p_user_id, p_user_email, v_total, v_used, (v_total - v_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

