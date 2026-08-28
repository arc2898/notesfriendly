-- Allow admins to delete timetables (parity with insert/update)
DROP POLICY IF EXISTS tt_delete_admin ON public.timetables;
CREATE POLICY tt_delete_admin ON public.timetables
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'god'::app_role));

-- Allow uploaders to soft-delete their own chat attachments via UPDATE
CREATE POLICY att_update_uploader ON public.chat_attachments
  FOR UPDATE TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY att_delete_uploader ON public.chat_attachments
  FOR DELETE TO authenticated
  USING (uploader_id = auth.uid());