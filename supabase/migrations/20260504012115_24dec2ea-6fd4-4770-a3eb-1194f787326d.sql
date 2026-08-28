
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

CREATE OR REPLACE FUNCTION public.validate_profile_bio()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.bio IS NOT NULL AND char_length(NEW.bio) > 280 THEN
    RAISE EXCEPTION 'Bio must be 280 characters or less';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_bio ON public.profiles;
CREATE TRIGGER profiles_validate_bio
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_bio();

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public) VALUES ('chat-wallpapers', 'chat-wallpapers', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "wallpapers_public_read" ON storage.objects;
CREATE POLICY "wallpapers_public_read" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-wallpapers');

DROP POLICY IF EXISTS "wallpapers_owner_insert" ON storage.objects;
CREATE POLICY "wallpapers_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "wallpapers_owner_update" ON storage.objects;
CREATE POLICY "wallpapers_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'chat-wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "wallpapers_owner_delete" ON storage.objects;
CREATE POLICY "wallpapers_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat-wallpapers' AND auth.uid()::text = (storage.foldername(name))[1]);
