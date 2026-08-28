
-- Allow sender to update their own messages (edit text, soft delete)
CREATE POLICY "Users can update own sent messages"
  ON public.messages FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid());

-- Allow recipient to mark messages as read
CREATE POLICY "Recipients can mark messages as read"
  ON public.messages FOR UPDATE TO authenticated
  USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());
