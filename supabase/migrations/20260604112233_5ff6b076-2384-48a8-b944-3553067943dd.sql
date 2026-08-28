
-- 1. Restrict admin_files table SELECT to admin/god only
DROP POLICY IF EXISTS admin_files_select ON public.admin_files;
CREATE POLICY admin_files_select ON public.admin_files
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role));

-- 2. Restrict admin-files storage SELECT to admin/god only
DROP POLICY IF EXISTS admin_files_select ON storage.objects;
CREATE POLICY admin_files_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'admin-files'
    AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role))
  );

-- 3. Restrict listing of public avatar/wallpaper buckets to owner's own folder
--    (direct public URL fetch still works for everyone since the buckets are public)
DROP POLICY IF EXISTS avatars_public_read ON storage.objects;
CREATE POLICY avatars_owner_list ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS wallpapers_public_read ON storage.objects;
CREATE POLICY wallpapers_owner_list ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-wallpapers'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4. Revoke EXECUTE on SECURITY DEFINER helper functions from PUBLIC/anon
--    These are used inside RLS policies and should not be callable directly
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_message(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_file_participant(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_chat_image_participant(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.analytics_summary() FROM PUBLIC, anon;

-- 5. Tighten notifications INSERT: only allow notifying users you've directly messaged
--    (removes the broad "any shared group" vector that enabled spam)
DROP POLICY IF EXISTS "Users can insert notifications for valid recipients" ON public.notifications;
CREATE POLICY "Users can insert notifications for valid recipients"
  ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    AND related_user_id = auth.uid()
    AND (
      -- direct message thread exists
      EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.deleted_at IS NULL
          AND (
            (m.from_user_id = auth.uid() AND m.to_user_id = notifications.user_id)
            OR (m.from_user_id = notifications.user_id AND m.to_user_id = auth.uid())
          )
          AND m.created_at > now() - interval '7 days'
      )
      -- group case: only when sender just posted in a group the recipient is in
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.chat_group_members gm ON gm.group_id = m.group_id
        WHERE m.from_user_id = auth.uid()
          AND gm.user_id = notifications.user_id
          AND m.deleted_at IS NULL
          AND m.created_at > now() - interval '5 minutes'
      )
    )
  );
