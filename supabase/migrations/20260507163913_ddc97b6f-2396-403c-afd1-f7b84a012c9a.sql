
-- 1. Attendance unique constraint (allows upsert on user+subject+date)
ALTER TABLE public.attendance_records
  ADD CONSTRAINT attendance_user_subject_date_uniq
  UNIQUE (user_id, subject_id, date);

-- 2. Message reactions
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, reaction)
);

CREATE INDEX idx_message_reactions_message ON public.message_reactions(message_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- Helper: can current user see the message?
CREATE OR REPLACE FUNCTION public.can_view_message(_message_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _message_id
      AND m.deleted_at IS NULL
      AND (
        m.from_user_id = auth.uid()
        OR m.to_user_id = auth.uid()
        OR (m.group_id IS NOT NULL AND public.is_group_member(m.group_id, auth.uid()))
      )
  )
$$;

CREATE POLICY mr_select ON public.message_reactions
  FOR SELECT TO authenticated
  USING (public.can_view_message(message_id));

CREATE POLICY mr_insert ON public.message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_view_message(message_id));

CREATE POLICY mr_delete ON public.message_reactions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;

-- 3. Career goal on preferences
ALTER TABLE public.user_preferences
  ADD COLUMN career_goal text;
