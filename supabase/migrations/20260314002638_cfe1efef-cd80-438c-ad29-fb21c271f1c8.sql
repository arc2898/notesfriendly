
-- Fix 1: Drop user_passwords table (removes plaintext password storage)
DROP POLICY IF EXISTS "god_select_passwords" ON public.user_passwords;
DROP POLICY IF EXISTS "users_insert_own_password" ON public.user_passwords;
DROP POLICY IF EXISTS "users_update_own_password" ON public.user_passwords;
DROP POLICY IF EXISTS "god_update_any_password" ON public.user_passwords;
DROP TABLE IF EXISTS public.user_passwords;

-- Fix 2: Update handle_new_user trigger to never assign god role from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, student_id, division, name, reg_no)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'student_id', ''),
    COALESCE(NEW.raw_user_meta_data->>'division', 'CS'),
    COALESCE(NEW.raw_user_meta_data->>'name', COALESCE(NEW.raw_user_meta_data->>'student_id', '')),
    COALESCE(NEW.raw_user_meta_data->>'student_id', '')
  );
  
  -- Always assign student role on signup. God role must be granted manually via service-role key.
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$function$;
