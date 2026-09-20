-- =====================================================================
-- Delivery Challan & E-Way Bill Management Dashboard
-- Supabase SQL schema
-- Run this in the Supabase SQL editor (or via `supabase db push`)
-- =====================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- companies : your own company profile (used on the printed DC header)
-- ---------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  company_name text not null,
  gstin text,
  pan text,
  address text,
  city text,
  district text,
  state text,
  state_code text,
  pin_code text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- partners : combined customer / vendor master
-- ---------------------------------------------------------------------
create table if not exists partners (
  id uuid primary key default uuid_generate_v4(),
  partner_type text not null check (partner_type in ('Customer', 'Vendor')),
  name text not null,
  short_name text,
  gstin text,
  pan text,
  contact_person text,
  phone text,
  email text,
  bill_to_address_line1 text,
  bill_to_address_line2 text,
  bill_to_city text,
  bill_to_district text,
  bill_to_state text,
  bill_to_state_code text,
  bill_to_pin text,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists partners_gstin_unique_idx
  on partners (gstin)
  where gstin is not null and gstin <> '';

create index if not exists partners_name_idx on partners using gin (to_tsvector('simple', name));
create index if not exists partners_type_idx on partners (partner_type);

-- ---------------------------------------------------------------------
-- partner_ship_to : one partner can have multiple ship-to addresses
-- ---------------------------------------------------------------------
create table if not exists partner_ship_to (
  id uuid primary key default uuid_generate_v4(),
  partner_id uuid not null references partners(id) on delete cascade,
  ship_to_name text,
  address_line1 text,
  address_line2 text,
  city text,
  district text,
  state text,
  state_code text,
  pin_code text,
  gstin text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists partner_ship_to_partner_idx on partner_ship_to (partner_id);

-- Ensure only one default Ship To per partner
create unique index if not exists partner_ship_to_one_default_idx
  on partner_ship_to (partner_id)
  where is_default = true;

-- ---------------------------------------------------------------------
-- items : item / product master
-- ---------------------------------------------------------------------
create table if not exists items (
  id uuid primary key default uuid_generate_v4(),
  item_code text not null,
  item_name text not null,
  description text,
  hsn text,
  uom text,
  gst_rate numeric(5,2) not null default 0,
  unit_price numeric(14,2) not null default 0,
  opening_quantity numeric(14,3) not null default 0,
  current_quantity numeric(14,3) not null default 0,
  reorder_level numeric(14,3) not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists items_item_code_unique_idx on items (item_code);
create index if not exists items_name_idx on items using gin (to_tsvector('simple', item_name));

-- ---------------------------------------------------------------------
-- dc_number_sequence : safe auto-numbering, one row per financial year
-- ---------------------------------------------------------------------
create table if not exists dc_number_sequence (
  year_key text primary key,          -- e.g. '2026'
  last_number integer not null default 0
);

-- Atomically reserves the next DC number for a given year and returns
-- a formatted number like DC-2026-0001. Using an UPDATE ... RETURNING
-- inside a function keeps this safe under concurrent inserts.
create or replace function next_dc_number(p_year text)
returns text
language plpgsql
as $$
declare
  v_next integer;
begin
  insert into dc_number_sequence (year_key, last_number)
  values (p_year, 1)
  on conflict (year_key)
  do update set last_number = dc_number_sequence.last_number + 1
  returning last_number into v_next;

  return 'DC-' || p_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------
-- delivery_challans
-- ---------------------------------------------------------------------
create table if not exists delivery_challans (
  id uuid primary key default uuid_generate_v4(),
  dc_number text not null unique,
  dc_date date not null default current_date,
  document_type text not null default 'Delivery Challan',
  partner_id uuid references partners(id),
  reference_number text,
  reference_date date,
  transporter_name text,
  vehicle_number text,
  transport_mode text,
  place_of_supply text,
  reason text,

  -- Address snapshots: captured at creation time and NEVER overwritten
  -- when the master partner record changes later (see section 16 of spec).
  bill_to_snapshot jsonb not null default '{}'::jsonb,
  ship_to_snapshot jsonb not null default '{}'::jsonb,

  total_quantity numeric(14,3) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,

  dc_status text not null default 'Draft'
    check (dc_status in ('Draft','Generated','Dispatched','Cancelled','Completed')),

  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dc_partner_idx on delivery_challans (partner_id);
create index if not exists dc_date_idx on delivery_challans (dc_date);
create index if not exists dc_status_idx on delivery_challans (dc_status);
create index if not exists dc_number_idx on delivery_challans (dc_number);

-- ---------------------------------------------------------------------
-- delivery_challan_items
-- ---------------------------------------------------------------------
create table if not exists delivery_challan_items (
  id uuid primary key default uuid_generate_v4(),
  delivery_challan_id uuid not null references delivery_challans(id) on delete cascade,
  item_id uuid references items(id),
  item_code text,
  item_name text,
  description text,
  hsn text,
  quantity numeric(14,3) not null default 0,
  uom text,
  unit_price numeric(14,2) not null default 0,
  taxable_value numeric(14,2) not null default 0,
  gst_rate numeric(5,2) not null default 0,
  cgst numeric(14,2) not null default 0,
  sgst numeric(14,2) not null default 0,
  igst numeric(14,2) not null default 0,
  total_value numeric(14,2) not null default 0,
  batch_no text,
  serial_no text,
  sl_no integer
);

create index if not exists dci_challan_idx on delivery_challan_items (delivery_challan_id);
create index if not exists dci_item_idx on delivery_challan_items (item_id);

-- ---------------------------------------------------------------------
-- eway_bills
-- ---------------------------------------------------------------------
create table if not exists eway_bills (
  id uuid primary key default uuid_generate_v4(),
  delivery_challan_id uuid not null references delivery_challans(id) on delete cascade,
  eway_bill_number text,
  eway_bill_date date,
  valid_until date,
  transporter_id text,
  transporter_name text,
  vehicle_number text,
  vehicle_type text,
  transport_mode text,
  distance_km numeric(10,2),
  status text not null default 'Not Generated'
    check (status in ('Not Generated','Pending','Generated','Cancelled','Expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists eway_dc_unique_idx on eway_bills (delivery_challan_id);
create index if not exists eway_status_idx on eway_bills (status);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_partners_updated_at on partners;
create trigger trg_partners_updated_at before update on partners
  for each row execute function set_updated_at();

drop trigger if exists trg_items_updated_at on items;
create trigger trg_items_updated_at before update on items
  for each row execute function set_updated_at();

drop trigger if exists trg_dc_updated_at on delivery_challans;
create trigger trg_dc_updated_at before update on delivery_challans
  for each row execute function set_updated_at();

drop trigger if exists trg_eway_updated_at on eway_bills;
create trigger trg_eway_updated_at before update on eway_bills
  for each row execute function set_updated_at();
