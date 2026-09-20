-- =====================================================================
-- Row Level Security policies
-- Model: any authenticated user of this app may read/write all business
-- data (typical for a small internal ERP team). Tighten with an
-- organization_id / role column if you need per-company multi-tenancy.
-- Run AFTER schema.sql.
-- =====================================================================

alter table companies enable row level security;
alter table partners enable row level security;
alter table partner_ship_to enable row level security;
alter table items enable row level security;
alter table dc_number_sequence enable row level security;
alter table delivery_challans enable row level security;
alter table delivery_challan_items enable row level security;
alter table eway_bills enable row level security;

-- companies
create policy "companies_select" on companies for select using (auth.role() = 'authenticated');
create policy "companies_insert" on companies for insert with check (auth.role() = 'authenticated');
create policy "companies_update" on companies for update using (auth.role() = 'authenticated');
create policy "companies_delete" on companies for delete using (auth.role() = 'authenticated');

-- partners
create policy "partners_select" on partners for select using (auth.role() = 'authenticated');
create policy "partners_insert" on partners for insert with check (auth.role() = 'authenticated');
create policy "partners_update" on partners for update using (auth.role() = 'authenticated');
create policy "partners_delete" on partners for delete using (auth.role() = 'authenticated');

-- partner_ship_to
create policy "ship_to_select" on partner_ship_to for select using (auth.role() = 'authenticated');
create policy "ship_to_insert" on partner_ship_to for insert with check (auth.role() = 'authenticated');
create policy "ship_to_update" on partner_ship_to for update using (auth.role() = 'authenticated');
create policy "ship_to_delete" on partner_ship_to for delete using (auth.role() = 'authenticated');

-- items
create policy "items_select" on items for select using (auth.role() = 'authenticated');
create policy "items_insert" on items for insert with check (auth.role() = 'authenticated');
create policy "items_update" on items for update using (auth.role() = 'authenticated');
create policy "items_delete" on items for delete using (auth.role() = 'authenticated');

-- dc_number_sequence (only touched via the next_dc_number() function, but
-- still needs a permissive policy so the function's caller is authorized)
create policy "dc_seq_select" on dc_number_sequence for select using (auth.role() = 'authenticated');
create policy "dc_seq_upsert" on dc_number_sequence for insert with check (auth.role() = 'authenticated');
create policy "dc_seq_update" on dc_number_sequence for update using (auth.role() = 'authenticated');

-- delivery_challans
create policy "dc_select" on delivery_challans for select using (auth.role() = 'authenticated');
create policy "dc_insert" on delivery_challans for insert with check (auth.role() = 'authenticated');
create policy "dc_update" on delivery_challans for update using (auth.role() = 'authenticated');
create policy "dc_delete" on delivery_challans for delete using (auth.role() = 'authenticated');

-- delivery_challan_items
create policy "dci_select" on delivery_challan_items for select using (auth.role() = 'authenticated');
create policy "dci_insert" on delivery_challan_items for insert with check (auth.role() = 'authenticated');
create policy "dci_update" on delivery_challan_items for update using (auth.role() = 'authenticated');
create policy "dci_delete" on delivery_challan_items for delete using (auth.role() = 'authenticated');

-- eway_bills
create policy "eway_select" on eway_bills for select using (auth.role() = 'authenticated');
create policy "eway_insert" on eway_bills for insert with check (auth.role() = 'authenticated');
create policy "eway_update" on eway_bills for update using (auth.role() = 'authenticated');
create policy "eway_delete" on eway_bills for delete using (auth.role() = 'authenticated');

-- Grant execute on the numbering function to authenticated users
grant execute on function next_dc_number(text) to authenticated;
