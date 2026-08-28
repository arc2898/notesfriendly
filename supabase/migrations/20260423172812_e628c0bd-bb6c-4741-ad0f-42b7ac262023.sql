-- 1) SECURITY DEFINER helper to check membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = _group_id AND user_id = _user_id
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;

-- 2) Fix recursive SELECT policy on chat_group_members
DROP POLICY IF EXISTS "Members can view group members" ON public.chat_group_members;

CREATE POLICY "Members can view group members"
ON public.chat_group_members
FOR SELECT
TO authenticated
USING (
  public.is_group_member(group_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.chat_groups g
    WHERE g.id = chat_group_members.group_id
      AND g.created_by = auth.uid()
  )
);

-- 3) Update messages policies that also reference chat_group_members to use the helper
DROP POLICY IF EXISTS "Group members can view group messages" ON public.messages;
CREATE POLICY "Group members can view group messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  group_id IS NOT NULL
  AND public.is_group_member(group_id, auth.uid())
);

DROP POLICY IF EXISTS "Group members can send group messages" ON public.messages;
CREATE POLICY "Group members can send group messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  group_id IS NOT NULL
  AND auth.uid() = from_user_id
  AND public.is_group_member(group_id, auth.uid())
);

-- 4) Update chat_groups SELECT policy similarly
DROP POLICY IF EXISTS "Members can view their groups" ON public.chat_groups;
CREATE POLICY "Members can view their groups"
ON public.chat_groups
FOR SELECT
TO authenticated
USING (
  public.is_group_member(id, auth.uid())
  OR created_by = auth.uid()
);