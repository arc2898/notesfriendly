
-- Fix 1: Re-create the trigger (was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Fix 2: Drop all RESTRICTIVE policies and recreate as PERMISSIVE

-- profiles
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Service role can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- messages
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT USING ((auth.uid() = from_user_id) OR (auth.uid() = to_user_id));
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- posts
DROP POLICY IF EXISTS "Anyone can read posts" ON public.posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update own posts" ON public.posts;

CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Users can create posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE USING (auth.uid() = author_id);

-- post_replies
DROP POLICY IF EXISTS "Anyone can read replies" ON public.post_replies;
DROP POLICY IF EXISTS "Users can create replies" ON public.post_replies;
DROP POLICY IF EXISTS "Users can delete own replies" ON public.post_replies;
DROP POLICY IF EXISTS "Users can update own replies" ON public.post_replies;

CREATE POLICY "Anyone can read replies" ON public.post_replies FOR SELECT USING (true);
CREATE POLICY "Users can create replies" ON public.post_replies FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users can delete own replies" ON public.post_replies FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Users can update own replies" ON public.post_replies FOR UPDATE USING (auth.uid() = author_id);

-- post_reactions
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.post_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.post_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.post_reactions;

CREATE POLICY "Anyone can read reactions" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON public.post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions" ON public.post_reactions FOR DELETE USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Authenticated can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "God can manage roles" ON public.user_roles;

CREATE POLICY "Authenticated can read roles" ON public.user_roles FOR SELECT USING (true);
CREATE POLICY "God can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'god'::app_role)) WITH CHECK (has_role(auth.uid(), 'god'::app_role));
