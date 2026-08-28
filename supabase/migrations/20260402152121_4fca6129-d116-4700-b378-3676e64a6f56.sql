
-- Create chat_groups table
CREATE TABLE public.chat_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_group_members table
CREATE TABLE public.chat_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- Add group_id to messages (null = DM, populated = group message)
ALTER TABLE public.messages ADD COLUMN group_id UUID REFERENCES public.chat_groups(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;

-- RLS for chat_groups: members can view groups they belong to
CREATE POLICY "Members can view their groups"
ON public.chat_groups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_groups.id
    AND chat_group_members.user_id = auth.uid()
  )
);

-- Anyone authenticated can create a group
CREATE POLICY "Authenticated users can create groups"
ON public.chat_groups FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- Creator can update group
CREATE POLICY "Creator can update group"
ON public.chat_groups FOR UPDATE TO authenticated
USING (created_by = auth.uid());

-- Creator can delete group
CREATE POLICY "Creator can delete group"
ON public.chat_groups FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- RLS for chat_group_members: members can view other members in their groups
CREATE POLICY "Members can view group members"
ON public.chat_group_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members AS m
    WHERE m.group_id = chat_group_members.group_id
    AND m.user_id = auth.uid()
  )
);

-- Creator of the group can add members
CREATE POLICY "Creator can add members"
ON public.chat_group_members FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_groups
    WHERE chat_groups.id = chat_group_members.group_id
    AND chat_groups.created_by = auth.uid()
  )
);

-- Creator can remove members
CREATE POLICY "Creator can remove members"
ON public.chat_group_members FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_groups
    WHERE chat_groups.id = chat_group_members.group_id
    AND chat_groups.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

-- Update messages RLS to allow group message access
CREATE POLICY "Group members can view group messages"
ON public.messages FOR SELECT TO authenticated
USING (
  group_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = messages.group_id
    AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can send group messages"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  group_id IS NOT NULL
  AND auth.uid() = from_user_id
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = messages.group_id
    AND chat_group_members.user_id = auth.uid()
  )
);

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_group_members;
