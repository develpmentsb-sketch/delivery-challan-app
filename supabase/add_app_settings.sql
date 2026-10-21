-- App-wide settings (used for the saved Sign-In panel layout on the login page).
-- Everyone (even before signing in) can READ it, so the login page can show the saved layout.
-- Only an active ADMIN can create or change it.
-- Run once in Supabase > SQL Editor.

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

drop policy if exists "app_settings_read" on app_settings;
drop policy if exists "app_settings_admin_insert" on app_settings;
drop policy if exists "app_settings_admin_update" on app_settings;

create policy "app_settings_read" on app_settings
  for select to anon, authenticated using (true);

create policy "app_settings_admin_insert" on app_settings
  for insert to authenticated
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active));

create policy "app_settings_admin_update" on app_settings
  for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active));

grant select on app_settings to anon, authenticated;
grant insert, update on app_settings to authenticated;
