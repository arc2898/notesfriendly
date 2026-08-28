-- Fix all RESTRICTIVE policies to PERMISSIVE

-- admin_files
DROP POLICY IF EXISTS "admin_files_meta_select" ON public.admin_files;
DROP POLICY IF EXISTS "admin_files_meta_insert" ON public.admin_files;
DROP POLICY IF EXISTS "admin_files_meta_delete" ON public.admin_files;

CREATE POLICY "admin_files_select" ON public.admin_files FOR SELECT USING (true);
CREATE POLICY "admin_files_insert" ON public.admin_files FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role));
CREATE POLICY "admin_files_delete" ON public.admin_files FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'god'::app_role));

-- messages
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
DROP POLICY IF EXISTS "messages_delete_own" ON public.messages;

CREATE POLICY "msg_select" ON public.messages FOR SELECT USING ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id));
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "msg_delete" ON public.messages FOR DELETE USING (auth.uid() = from_user_id);

-- posts
DROP POLICY IF EXISTS "posts_select_all" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_own" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_own" ON public.posts;
DROP POLICY IF EXISTS "posts_update_own" ON public.posts;

CREATE POLICY "p_select" ON public.posts FOR SELECT USING (true);
CREATE POLICY "p_insert" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "p_delete" ON public.posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "p_update" ON public.posts FOR UPDATE USING (auth.uid() = author_id);

-- post_replies
DROP POLICY IF EXISTS "replies_select_all" ON public.post_replies;
DROP POLICY IF EXISTS "replies_insert_own" ON public.post_replies;
DROP POLICY IF EXISTS "replies_delete_own" ON public.post_replies;
DROP POLICY IF EXISTS "replies_update_own" ON public.post_replies;

CREATE POLICY "r_select" ON public.post_replies FOR SELECT USING (true);
CREATE POLICY "r_insert" ON public.post_replies FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "r_delete" ON public.post_replies FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "r_update" ON public.post_replies FOR UPDATE USING (auth.uid() = author_id);

-- post_reactions
DROP POLICY IF EXISTS "reactions_select_all" ON public.post_reactions;
DROP POLICY IF EXISTS "reactions_insert_own" ON public.post_reactions;
DROP POLICY IF EXISTS "reactions_delete_own" ON public.post_reactions;

CREATE POLICY "rx_select" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "rx_insert" ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rx_delete" ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

-- profiles
DROP POLICY IF EXISTS "profiles_insert_service" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "prof_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "prof_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "prof_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
DROP POLICY IF EXISTS "roles_select_all" ON public.user_roles;
DROP POLICY IF EXISTS "roles_manage_god" ON public.user_roles;

CREATE POLICY "ur_select" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "ur_manage" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'god'::app_role)) WITH CHECK (has_role(auth.uid(), 'god'::app_role));

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();