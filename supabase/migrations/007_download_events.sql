-- Download Events Table
-- Tracks when users download images
CREATE TABLE IF NOT EXISTS download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  image_url TEXT NOT NULL,
  generation_id UUID,
  image_index INTEGER,
  source TEXT NOT NULL DEFAULT 'unknown', -- gallery, camera, studio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_download_events_user_id ON download_events(user_id);
CREATE INDEX IF NOT EXISTS idx_download_events_created_at ON download_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_download_events_generation_id ON download_events(generation_id);
CREATE INDEX IF NOT EXISTS idx_download_events_source ON download_events(source);

-- Enable Row Level Security
ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can insert their own download events
CREATE POLICY "Users can insert download events" ON download_events
  FOR INSERT WITH CHECK (true);

-- Users can view their own download events
CREATE POLICY "Users can view their own downloads" ON download_events
  FOR SELECT USING (auth.uid() = user_id);

