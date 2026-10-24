-- Advanced Vendor Master fields: vendor code (auto), group, rating, status,
-- GST type, MSME number, payment terms, credit limit / days, TDS section / rate.
-- Safe to run more than once. Run in Supabase > SQL Editor BEFORE using the new Add Vendor window.

alter table partners
  add column if not exists vendor_code text,
  add column if not exists vendor_group text,
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists vendor_status text not null default 'Active'
    check (vendor_status in ('Active', 'On Hold', 'Blocked')),
  add column if not exists gst_type text not null default 'Regular',
  add column if not exists msme_number text,
  add column if not exists payment_terms text,
  add column if not exists credit_days integer check (credit_days >= 0),
  add column if not exists credit_limit numeric(14, 2) check (credit_limit >= 0),
  add column if not exists tds_section text,
  add column if not exists tds_rate numeric(5, 2) check (tds_rate between 0 and 100);

-- Existing inactive vendors become "On Hold"
update partners set vendor_status = 'On Hold' where active = false and vendor_status = 'Active';

-- Automatic vendor codes: V0001, V0002, ...
create sequence if not exists vendor_code_seq;

create or replace function set_vendor_code() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.partner_type = 'Vendor' and (new.vendor_code is null or new.vendor_code = '') then
    new.vendor_code := 'V' || lpad(nextval('vendor_code_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists partners_set_vendor_code on partners;
create trigger partners_set_vendor_code
  before insert on partners
  for each row execute function set_vendor_code();

-- Give the vendors that already exist a code, oldest first
do $$
declare r record;
begin
  for r in select id from partners where partner_type = 'Vendor' and vendor_code is null order by created_at loop
    update partners set vendor_code = 'V' || lpad(nextval('vendor_code_seq')::text, 4, '0') where id = r.id;
  end loop;
end $$;

create unique index if not exists partners_vendor_code_unique_idx
  on partners (vendor_code) where vendor_code is not null;
