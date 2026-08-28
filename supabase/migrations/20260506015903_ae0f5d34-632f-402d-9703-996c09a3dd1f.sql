
create table public.user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  subject_code text not null,
  folder_type text not null,
  file_name text not null,
  file_path text not null,
  created_at timestamptz not null default now(),
  unique(user_id, file_path)
);
alter table public.user_bookmarks enable row level security;
create policy bm_select on public.user_bookmarks for select to authenticated using (user_id = auth.uid());
create policy bm_insert on public.user_bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy bm_delete on public.user_bookmarks for delete to authenticated using (user_id = auth.uid());
create policy bm_update on public.user_bookmarks for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.user_preferences (
  user_id uuid primary key,
  saved_searches jsonb not null default '[]'::jsonb,
  muted_groups jsonb not null default '[]'::jsonb,
  muted_users jsonb not null default '[]'::jsonb,
  muted_subjects jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;
create policy up_select on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy up_insert on public.user_preferences for insert to authenticated with check (user_id = auth.uid());
create policy up_update on public.user_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy up_delete on public.user_preferences for delete to authenticated using (user_id = auth.uid());
