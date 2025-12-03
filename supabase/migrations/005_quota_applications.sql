-- Quota Applications Table
-- Stores user requests for more quota
CREATE TABLE IF NOT EXISTS quota_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  reason TEXT NOT NULL,
  feedback TEXT,
  current_quota INTEGER NOT NULL DEFAULT 30,
  used_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_quota_applications_status ON quota_applications(status);
CREATE INDEX IF NOT EXISTS idx_quota_applications_email ON quota_applications(email);
CREATE INDEX IF NOT EXISTS idx_quota_applications_created_at ON quota_applications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE quota_applications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own applications
CREATE POLICY "Users can view their own applications" ON quota_applications
  FOR SELECT USING (auth.uid() = user_id OR email = auth.jwt()->>'email');

-- Users can insert applications
CREATE POLICY "Users can insert applications" ON quota_applications
  FOR INSERT WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quota_applications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_quota_applications_updated_at ON quota_applications;
CREATE TRIGGER update_quota_applications_updated_at
  BEFORE UPDATE ON quota_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_quota_applications_updated_at();

