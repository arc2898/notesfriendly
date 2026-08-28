
-- 1) Fix is_chat_image_participant to include group members
CREATE OR REPLACE FUNCTION public.is_chat_image_participant(image_path text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.image_url = image_path
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
$function$;

-- 2) Restrict DM inserts to enrolled users (both sender and recipient must have a profile)
DROP POLICY IF EXISTS msg_insert ON public.messages;
CREATE POLICY msg_insert ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = from_user_id
  AND (
    -- Group message path validated by separate policy
    group_id IS NOT NULL
    OR (
      to_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = to_user_id)
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
    )
  )
);

-- 3) Prevent senders from mutating recipient/group/read after send via trigger
CREATE OR REPLACE FUNCTION public.prevent_message_field_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Recipients marking as read: only is_read may change
  IF NEW.to_user_id = auth.uid() AND OLD.from_user_id <> auth.uid() THEN
    IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
       OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.text IS DISTINCT FROM OLD.text
       OR NEW.image_url IS DISTINCT FROM OLD.image_url
       OR NEW.attachment_id IS DISTINCT FROM OLD.attachment_id
       OR NEW.reply_to_id IS DISTINCT FROM OLD.reply_to_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Recipients may only update is_read';
    END IF;
    RETURN NEW;
  END IF;

  -- Sender edits: cannot change routing or read state
  IF OLD.from_user_id = auth.uid() THEN
    IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
       OR NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.is_read IS DISTINCT FROM OLD.is_read
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Senders cannot change routing or read status';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_message_field_mutation ON public.messages;
CREATE TRIGGER trg_prevent_message_field_mutation
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_message_field_mutation();
