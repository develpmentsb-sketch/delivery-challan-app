-- =====================================================================
-- Vendor Master: allocate each vendor to a company (company_locations)
-- Run this ONCE in the Supabase SQL editor, after add_company_locations.sql
-- =====================================================================

-- 1) Which company a vendor belongs to.
--    NULL = "All Companies" -> the vendor is offered no matter which
--    company/location is chosen when creating a Delivery Challan.
--    A specific id restricts the vendor to that company only.
alter table partners
  add column if not exists company_location_id uuid references company_locations(id) on delete set null;

create index if not exists partners_company_location_idx on partners (company_location_id);

-- 2) Optional cleanup: the app UI now only creates/shows partner_type =
--    'Vendor' records (the old "Customer" tab has been removed from
--    Vendor Master). Existing Customer rows are left in the database
--    untouched and simply no longer appear in Vendor Master. If you want
--    to fully retire them, run the line below manually:
-- update partners set partner_type = 'Vendor' where partner_type = 'Customer';
