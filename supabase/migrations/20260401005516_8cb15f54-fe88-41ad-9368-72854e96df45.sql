
-- Fix 1: Restrict profile INSERT to own user only (prevents identity impersonation)
DROP POLICY prof_insert ON profiles;
CREATE POLICY prof_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Fix 2: Restrict user_roles SELECT to own roles (god can see all)
DROP POLICY ur_select ON user_roles;
CREATE POLICY ur_select ON user_roles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR has_role(auth.uid(), 'god'::app_role)
  );
