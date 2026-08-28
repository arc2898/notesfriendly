ALTER TABLE public.admin_files ADD COLUMN IF NOT EXISTS division text;
CREATE INDEX IF NOT EXISTS idx_admin_files_division ON public.admin_files (division);
COMMENT ON COLUMN public.admin_files.division IS 'Target division (CS/BS/IT). NULL = visible to all divisions.';