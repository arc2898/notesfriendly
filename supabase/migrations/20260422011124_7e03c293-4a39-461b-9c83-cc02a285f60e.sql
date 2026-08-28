-- Allow group messages to omit to_user_id (group messages have group_id instead)
ALTER TABLE public.messages ALTER COLUMN to_user_id DROP NOT NULL;

-- Ensure realtime UPDATE/DELETE payloads include full row so subscribers see edits/deletes
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.chat_groups REPLICA IDENTITY FULL;
ALTER TABLE public.chat_group_members REPLICA IDENTITY FULL;

-- Faster DM conversation lookups
CREATE INDEX IF NOT EXISTS idx_messages_dm_pair
  ON public.messages (from_user_id, to_user_id, created_at)
  WHERE group_id IS NULL;