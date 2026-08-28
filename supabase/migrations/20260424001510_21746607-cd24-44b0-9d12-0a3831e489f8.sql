-- Per-user attendance tracker tables

-- 1) user_subjects: each student has their own list of subjects (seeded with defaults via UI)
CREATE TABLE public.user_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  threshold integer NOT NULL DEFAULT 75,
  color text DEFAULT 'from-blue-500 to-cyan-400',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);

ALTER TABLE public.user_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_subjects_select_own" ON public.user_subjects
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_subjects_insert_own" ON public.user_subjects
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_subjects_update_own" ON public.user_subjects
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_subjects_delete_own" ON public.user_subjects
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) attendance_records: one row per (user, subject, date)
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'cancelled');

CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.user_subjects(id) ON DELETE CASCADE,
  date date NOT NULL,
  status public.attendance_status NOT NULL DEFAULT 'present',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id, date)
);

CREATE INDEX idx_attendance_user_date ON public.attendance_records (user_id, date DESC);
CREATE INDEX idx_attendance_subject ON public.attendance_records (subject_id);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendance_select_own" ON public.attendance_records
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "attendance_insert_own" ON public.attendance_records
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_update_own" ON public.attendance_records
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_delete_own" ON public.attendance_records
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- update_updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Enable realtime on notifications for live delivery (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;