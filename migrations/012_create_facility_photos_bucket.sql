-- Create storage bucket for facility photos
-- This bucket will store all photos downloaded from SerpAPI

-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'facility-photos',
  'facility-photos',
  true, -- Public bucket for read access
  10485760, -- 10MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to all files
CREATE POLICY "Public read access for facility photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'facility-photos');

-- Policy: Allow service role to insert files
CREATE POLICY "Service role can insert facility photos"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'facility-photos');

-- Policy: Allow service role to update files
CREATE POLICY "Service role can update facility photos"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'facility-photos');

-- Policy: Allow service role to delete files
CREATE POLICY "Service role can delete facility photos"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'facility-photos');
