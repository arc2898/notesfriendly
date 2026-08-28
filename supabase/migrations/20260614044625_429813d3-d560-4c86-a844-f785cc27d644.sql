
-- admin-files: only admins/god can update
CREATE POLICY "admin_files_update_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'admin-files' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'god'::app_role)))
WITH CHECK (bucket_id = 'admin-files' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'god'::app_role)));

-- chat-files: only uploader (path prefix = their uid) can update
CREATE POLICY "chat_files_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'chat-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- chat-images: only uploader can update
CREATE POLICY "chat_images_update_owner"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'chat-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- notifications: owner can delete
CREATE POLICY "notifications_delete_owner"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());
