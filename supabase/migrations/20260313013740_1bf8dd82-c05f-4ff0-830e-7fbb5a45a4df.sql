
-- Table to store plain-text passwords (only god can view)
CREATE TABLE public.user_passwords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  password_plain text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_passwords ENABLE ROW LEVEL SECURITY;

-- Only god can SELECT passwords
CREATE POLICY "god_select_passwords"
  ON public.user_passwords FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'god'));

-- Authenticated users can INSERT their own password row
CREATE POLICY "users_insert_own_password"
  ON public.user_passwords FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Authenticated users can UPDATE their own password row
CREATE POLICY "users_update_own_password"
  ON public.user_passwords FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- God can also update any password row (for resets)
CREATE POLICY "god_update_any_password"
  ON public.user_passwords FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'god'));
