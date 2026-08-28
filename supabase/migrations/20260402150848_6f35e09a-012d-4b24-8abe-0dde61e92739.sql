
-- Create a function to check if a user is a participant in a chat that contains a specific image
CREATE OR REPLACE FUNCTION public.is_chat_image_participant(image_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages
    WHERE image_url = image_path
    AND (from_user_id = auth.uid() OR to_user_id = auth.uid())
    AND deleted_at IS NULL
  )
$$;

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view chat images" ON storage.objects;

-- Allow only the image uploader (folder owner) or message participants to view chat images
CREATE POLICY "chat_images_participant_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-images'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_chat_image_participant(name)
  )
);
