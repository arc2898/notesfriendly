
-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "prof_select" ON public.profiles;
DROP POLICY IF EXISTS "prof_insert" ON public.profiles;
DROP POLICY IF EXISTS "prof_update" ON public.profiles;
CREATE POLICY "prof_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "prof_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prof_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- messages
DROP POLICY IF EXISTS "msg_select" ON public.messages;
DROP POLICY IF EXISTS "msg_insert" ON public.messages;
DROP POLICY IF EXISTS "msg_delete" ON public.messages;
CREATE POLICY "msg_select" ON public.messages FOR SELECT TO authenticated USING ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "msg_delete" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = from_user_id);

-- posts
DROP POLICY IF EXISTS "p_select" ON public.posts;
DROP POLICY IF EXISTS "p_insert" ON public.posts;
DROP POLICY IF EXISTS "p_delete" ON public.posts;
DROP POLICY IF EXISTS "p_update" ON public.posts;
CREATE POLICY "p_select" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "p_insert" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "p_delete" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "p_update" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- post_replies
DROP POLICY IF EXISTS "r_select" ON public.post_replies;
DROP POLICY IF EXISTS "r_insert" ON public.post_replies;
DROP POLICY IF EXISTS "r_delete" ON public.post_replies;
DROP POLICY IF EXISTS "r_update" ON public.post_replies;
CREATE POLICY "r_select" ON public.post_replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "r_insert" ON public.post_replies FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "r_delete" ON public.post_replies FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "r_update" ON public.post_replies FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- post_reactions
DROP POLICY IF EXISTS "rx_select" ON public.post_reactions;
DROP POLICY IF EXISTS "rx_insert" ON public.post_reactions;
DROP POLICY IF EXISTS "rx_delete" ON public.post_reactions;
CREATE POLICY "rx_select" ON public.post_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "rx_insert" ON public.post_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rx_delete" ON public.post_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "ur_select" ON public.user_roles;
DROP POLICY IF EXISTS "ur_manage" ON public.user_roles;
CREATE POLICY "ur_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "ur_manage" ON public.user_roles FOR ALL TO authenticated USING (has_role(auth.uid(), 'god'::app_role)) WITH CHECK (has_role(auth.uid(), 'god'::app_role));

-- admin_files
DROP POLICY IF EXISTS "admin_files_select" ON public.admin_files;
DROP POLICY IF EXISTS "admin_files_insert" ON public.admin_files;
DROP POLICY IF EXISTS "admin_files_delete" ON public.admin_files;
CREATE POLICY "admin_files_select" ON public.admin_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_files_insert" ON public.admin_files FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role));
CREATE POLICY "admin_files_delete" ON public.admin_files FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role));

-- Recreate trigger for new user signup (in case missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
