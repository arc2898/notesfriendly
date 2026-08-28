REVOKE EXECUTE ON FUNCTION public.analytics_summary() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.analytics_summary() TO authenticated;