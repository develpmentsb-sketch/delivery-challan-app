-- =====================================================================
-- Run this once in the Supabase SQL editor of your project.
-- Adds the missing `pincode` column to company_settings, and sets up
-- a public storage bucket + policies for the company logo upload.
-- =====================================================================

-- 1) Add pincode column to the company_settings table (the table your
--    app already reads/writes via src/lib/companyProfile.js)
alter table company_settings
  add column if not exists pincode text;

-- 2) Create a public bucket to hold the uploaded logo file.
--    (If you prefer, you can instead create this bucket manually via
--    Dashboard -> Storage -> New bucket -> name: company-assets -> Public: ON)
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do update set public = true;

-- 3) Allow any authenticated (logged-in) user of your app to upload/replace
--    the logo, and allow anyone to read it (so it can be embedded in the
--    printed PDF, which loads it as a plain <img> tag).
drop policy if exists "company-assets read" on storage.objects;
create policy "company-assets read"
  on storage.objects for select
  using (bucket_id = 'company-assets');

drop policy if exists "company-assets insert" on storage.objects;
create policy "company-assets insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'company-assets');

drop policy if exists "company-assets update" on storage.objects;
create policy "company-assets update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'company-assets');
