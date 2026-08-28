
-- Fix: remove the realtime add since it's already there, just add storage policies and trigger

-- Storage policies for admin-files bucket
DROP POLICY IF EXISTS "admin_files_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "admin_files_storage_delete" ON storage.objects;

CREATE POLICY "admin_files_storage_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'admin-files');
CREATE POLICY "admin_files_storage_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'admin-files' AND (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role)));
CREATE POLICY "admin_files_storage_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'admin-files' AND (SELECT has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role)));

-- Recreate trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
