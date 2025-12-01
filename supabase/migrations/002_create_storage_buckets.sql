-- Create storage buckets for Brand Camera

-- Presets bucket (public, for official preset images)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'presets',
  'presets',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- User assets bucket (public URLs, authenticated upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-assets',
  'user-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Generations bucket (public URLs, authenticated upload)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generations',
  'generations',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policies for presets bucket (read-only for everyone)
CREATE POLICY "Presets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'presets');

-- Policies for user-assets bucket
CREATE POLICY "User assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-assets');

CREATE POLICY "Authenticated users can upload user assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-assets' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policies for generations bucket
CREATE POLICY "Generations are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'generations');

CREATE POLICY "Authenticated users can upload generations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'generations' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own generations"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'generations' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own generations"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'generations' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

