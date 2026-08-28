
-- Make admin-files bucket private
UPDATE storage.buckets SET public = false WHERE id = 'admin-files';

-- Make chat-images bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-images';

-- Fix chat-images INSERT policy to enforce path ownership
DROP POLICY "Authenticated users can upload chat images" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
