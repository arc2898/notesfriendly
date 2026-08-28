-- ============================================================
-- Security hardening migration
-- ============================================================

-- 1. Notifications: validate type/length and prevent abuse ---------------
DROP POLICY IF EXISTS "Users can insert notifications for others" ON public.notifications;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check,
  DROP CONSTRAINT IF EXISTS notifications_title_len,
  DROP CONSTRAINT IF EXISTS notifications_body_len;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('message', 'group_message', 'reply', 'reaction', 'system')),
  ADD CONSTRAINT notifications_title_len
    CHECK (char_length(title) BETWEEN 1 AND 200),
  ADD CONSTRAINT notifications_body_len
    CHECK (body IS NULL OR char_length(body) <= 1000);

CREATE POLICY "Users can insert notifications for valid recipients"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id <> auth.uid()
    AND related_user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.deleted_at IS NULL
          AND (
            (m.from_user_id = auth.uid() AND m.to_user_id = notifications.user_id)
            OR (m.from_user_id = notifications.user_id AND m.to_user_id = auth.uid())
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.chat_group_members gm1
        JOIN public.chat_group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid()
          AND gm2.user_id = notifications.user_id
      )
    )
  );

-- 2. Storage: remove duplicate admin-files policies & fix INSERT logic --
DROP POLICY IF EXISTS "admin_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_storage_delete" ON storage.objects;

DROP POLICY IF EXISTS "admin_files_select" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_delete" ON storage.objects;

CREATE POLICY "admin_files_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'admin-files');

CREATE POLICY "admin_files_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'admin-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'god'))
  );

CREATE POLICY "admin_files_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'admin-files'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'god'))
  );

-- 3. Move pg_net out of public schema (drop + recreate in extensions) ----
CREATE SCHEMA IF NOT EXISTS extensions;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;