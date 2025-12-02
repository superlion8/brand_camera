-- User Assets Table (models, backgrounds, products, vibes)
CREATE TABLE IF NOT EXISTS user_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('model', 'background', 'product', 'vibe')),
  name TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  tags TEXT[],
  subcategory TEXT,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_type ON user_assets(user_id, type);

-- Generations Table
CREATE TABLE IF NOT EXISTS generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('camera_product', 'camera_model', 'edit', 'studio')),
  input_image_url TEXT NOT NULL,
  input_image2_url TEXT,
  output_image_urls TEXT[] NOT NULL,
  output_model_types TEXT[],
  output_gen_modes TEXT[],
  prompt TEXT,
  prompts TEXT[],
  params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(user_id, created_at DESC);

-- Favorites Table
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  image_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, generation_id, image_index)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- Pinned Presets Table (for official preset pins)
CREATE TABLE IF NOT EXISTS pinned_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preset_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_presets_user_id ON pinned_presets(user_id);

-- Enable Row Level Security
ALTER TABLE user_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_assets
CREATE POLICY "Users can view their own assets" ON user_assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assets" ON user_assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assets" ON user_assets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own assets" ON user_assets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for generations
CREATE POLICY "Users can view their own generations" ON generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own generations" ON generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations" ON generations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own generations" ON generations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for favorites
CREATE POLICY "Users can view their own favorites" ON favorites
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites" ON favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites" ON favorites
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for pinned_presets
CREATE POLICY "Users can view their own pinned presets" ON pinned_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pinned presets" ON pinned_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pinned presets" ON pinned_presets
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_assets updated_at
CREATE TRIGGER update_user_assets_updated_at
  BEFORE UPDATE ON user_assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

