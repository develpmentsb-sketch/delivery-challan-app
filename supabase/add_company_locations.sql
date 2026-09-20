-- =====================================================================
-- Multiple company locations (branches / warehouses / plants)
-- Run this ONCE in the Supabase SQL editor.
-- =====================================================================

-- 1) Locations table (Settings -> Company Locations)
create table if not exists company_locations (
  id uuid primary key default gen_random_uuid(),
  location_name text not null,
  address text,
  city text,
  state text,
  state_code text,
  pincode text,
  gstin text,            -- leave empty to use the company GSTIN
  phone text,
  email text,
  is_default boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- only one default location
create unique index if not exists company_locations_one_default_idx
  on company_locations (is_default) where is_default = true;

-- 2) Which location each Delivery Challan was dispatched from.
--    dispatch_from_snapshot freezes the address/GSTIN used at creation time,
--    so later edits to a location never change old challans.
alter table delivery_challans
  add column if not exists location_id uuid references company_locations(id) on delete set null;
alter table delivery_challans
  add column if not exists dispatch_from_snapshot jsonb not null default '{}'::jsonb;

create index if not exists dc_location_idx on delivery_challans (location_id);

-- 3) Row level security: everyone signed in can read, only admins can change
create or replace function is_app_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;
grant execute on function is_app_admin() to authenticated;

alter table company_locations enable row level security;

drop policy if exists "company_locations_select" on company_locations;
create policy "company_locations_select" on company_locations
  for select using (auth.role() = 'authenticated');

drop policy if exists "company_locations_insert" on company_locations;
create policy "company_locations_insert" on company_locations
  for insert with check (is_app_admin());

drop policy if exists "company_locations_update" on company_locations;
create policy "company_locations_update" on company_locations
  for update using (is_app_admin());

drop policy if exists "company_locations_delete" on company_locations;
create policy "company_locations_delete" on company_locations
  for delete using (is_app_admin());

-- 4) updated_at trigger (set_updated_at() already exists from schema.sql)
drop trigger if exists trg_company_locations_updated_at on company_locations;
create trigger trg_company_locations_updated_at before update on company_locations
  for each row execute function set_updated_at();
