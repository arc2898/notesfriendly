-- 1. chat_attachments table
CREATE TABLE public.chat_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uploader_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages
  ADD COLUMN attachment_id UUID REFERENCES public.chat_attachments(id) ON DELETE SET NULL;

CREATE INDEX idx_chat_attachments_expires ON public.chat_attachments(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_attachment ON public.messages(attachment_id) WHERE attachment_id IS NOT NULL;

ALTER TABLE public.chat_attachments ENABLE ROW LEVEL SECURITY;

-- Insert: only as self
CREATE POLICY "att_insert" ON public.chat_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid());

-- Select: visible if user can see the linked message
CREATE POLICY "att_select" ON public.chat_attachments
  FOR SELECT TO authenticated
  USING (
    uploader_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.attachment_id = chat_attachments.id
      AND (
        m.from_user_id = auth.uid()
        OR m.to_user_id = auth.uid()
        OR (m.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.chat_group_members gm
          WHERE gm.group_id = m.group_id AND gm.user_id = auth.uid()
        ))
      )
    )
  );

-- 2. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat-files', 'chat-files', false, 104857600)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 104857600;

-- Storage RLS: uploader can write to their own folder
CREATE POLICY "chat_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Read: anyone who is a participant of a message that references this path
CREATE OR REPLACE FUNCTION public.is_chat_file_participant(file_path TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chat_attachments a ON a.id = m.attachment_id
    WHERE a.file_path = file_path
    AND a.deleted_at IS NULL
    AND m.deleted_at IS NULL
    AND (
      m.from_user_id = auth.uid()
      OR m.to_user_id = auth.uid()
      OR (m.group_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.chat_group_members gm
        WHERE gm.group_id = m.group_id AND gm.user_id = auth.uid()
      ))
    )
  )
$$;

CREATE POLICY "chat_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_chat_file_participant(name)
    )
  );

CREATE POLICY "chat_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 3. Enable cron + net for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;