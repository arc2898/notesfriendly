
CREATE TABLE IF NOT EXISTS public.timetables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  division TEXT NOT NULL UNIQUE,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  times JSONB NOT NULL DEFAULT '[]'::jsonb,
  grid JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tt_select_all" ON public.timetables
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tt_insert_admin" ON public.timetables
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'god'));

CREATE POLICY "tt_update_admin" ON public.timetables
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'god'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'god'));

CREATE POLICY "tt_delete_admin" ON public.timetables
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'god'));

CREATE TRIGGER timetables_set_updated_at
BEFORE UPDATE ON public.timetables
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.timetables;
ALTER TABLE public.timetables REPLICA IDENTITY FULL;

-- Seed CS
INSERT INTO public.timetables (division, days, times, grid) VALUES (
  'CS',
  '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]'::jsonb,
  '["9:00-9:50","9:50-10:40","10:55-11:45","11:45-12:35","1:30-2:20","2:20-3:10","3:10-4:10"]'::jsonb,
  '{
    "Monday":["DS","EP","BEEE","DEVC","","EPL/ITWS",""],
    "Tuesday":["BEEE","COUN","DEVC","NNSCS","","DSL/EEEWS",""],
    "Wednesday":["EP","","EG","","DEVC","DS","BEEE"],
    "Thursday":["EP","DS","","EG","DEVC","SS",""],
    "Friday":["DS","","ITWS/EPL","","DEVC","BEEE","EP"],
    "Saturday":["DEVC","","EEEWS/DSL","","EP","BEEE","DS"]
  }'::jsonb
) ON CONFLICT (division) DO NOTHING;

-- Seed BS
INSERT INTO public.timetables (division, days, times, grid) VALUES (
  'BS',
  '["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]'::jsonb,
  '["9:00-9:50","9:50-10:40","10:55-11:45","11:45-12:35","1:30-2:20","2:20-3:10","3:10-4:10"]'::jsonb,
  '{
    "Monday":["DS","DS","DEVC","EP","BEEE","EG","EG"],
    "Tuesday":["EP","EPL/ITWS","EPL/ITWS","","DEVC","BEEE","DS"],
    "Wednesday":["DEVC","EP","SS","SS","DSL/EEEWS","DSL/EEEWS",""],
    "Thursday":["NNSCS","BEEE","DEVC","EP","ITWS/EPL","ITWS/EPL",""],
    "Friday":["BEEE","","EEEWS/DSL","EEEWS/DSL","DEVC","EP","DS"],
    "Saturday":["BEEE","DEVC","COUN","DS","EG","",""]
  }'::jsonb
) ON CONFLICT (division) DO NOTHING;
