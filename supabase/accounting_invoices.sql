-- Sales & Purchase invoices for the Accounting module. Run ONCE after accounting.sql. Safe to run again.

-- 1. Allow Sales and Purchase vouchers
alter table acc_vouchers drop constraint if exists acc_vouchers_voucher_type_check;
alter table acc_vouchers add constraint acc_vouchers_voucher_type_check
  check (voucher_type in ('Payment','Receipt','Journal','Contra','Sales','Purchase'));

-- 2. Invoice header and item lines
create table if not exists acc_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_locations(id) on delete cascade,
  kind text not null check (kind in ('Sales','Purchase')),
  voucher_id uuid not null unique references acc_vouchers(id) on delete cascade,
  fy text not null,
  invoice_no text not null,
  invoice_date date not null,
  due_date date,
  party_ledger_id uuid not null references acc_ledgers(id) on delete restrict,
  party_gstin text,
  place_of_supply text,
  supply_type text not null check (supply_type in ('Intra','Inter')),
  reference text,
  narration text,
  taxable numeric(16,2) not null default 0,
  cgst numeric(16,2) not null default 0,
  sgst numeric(16,2) not null default 0,
  igst numeric(16,2) not null default 0,
  round_off numeric(16,2) not null default 0,
  total numeric(16,2) not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table acc_invoices add column if not exists party_address text;
create index if not exists acc_invoices_company_date_idx on acc_invoices (company_id, kind, invoice_date);
-- A sales invoice number is unique per year; a purchase invoice number is unique per supplier per year
create unique index if not exists acc_invoices_sales_no_uidx on acc_invoices (company_id, fy, invoice_no) where kind = 'Sales';
create unique index if not exists acc_invoices_purchase_no_uidx on acc_invoices (company_id, fy, party_ledger_id, invoice_no) where kind = 'Purchase';

create table if not exists acc_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references acc_invoices(id) on delete cascade,
  line_no int not null default 1,
  description text not null,
  hsn text,
  qty numeric(14,3) not null check (qty > 0),
  uom text,
  rate numeric(16,2) not null default 0 check (rate >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  gst_rate numeric(5,2) not null default 0 check (gst_rate between 0 and 100),
  taxable numeric(16,2) not null default 0
);
create index if not exists acc_invoice_lines_inv_idx on acc_invoice_lines (invoice_id);

-- 3. Security (same roles as the rest of the app)
do $$
declare t text;
begin
  foreach t in array array['acc_invoices','acc_invoice_lines'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format('drop policy if exists %I on %I', t || '_ins', t);
    execute format('drop policy if exists %I on %I', t || '_upd', t);
    execute format('drop policy if exists %I on %I', t || '_del', t);
    execute format('create policy %I on %I for select using (app_role() is not null)', t || '_sel', t);
    execute format('create policy %I on %I for insert with check (app_role() in (''admin'',''user''))', t || '_ins', t);
    execute format('create policy %I on %I for update using (app_role() in (''admin'',''user'')) with check (app_role() in (''admin'',''user''))', t || '_upd', t);
    if t = 'acc_invoice_lines' then
      execute format('create policy %I on %I for delete using (app_role() in (''admin'',''user''))', t || '_del', t);
    else
      execute format('create policy %I on %I for delete using (app_role() = ''admin'')', t || '_del', t);
    end if;
    execute format('grant select, insert, update, delete on table %I to authenticated', t);
    execute format('grant select, insert, update, delete on table %I to service_role', t);
  end loop;
end $$;

-- 4. Save an invoice and post its voucher in one step
--    p_lines : [{description,hsn,qty,uom,rate,discount_pct,gst_rate}]
--    p_ledgers: {"main":<sales or purchase ledger id>,"cgst":id,"sgst":id,"igst":id,"round":id}
create or replace function acc_save_invoice(
  p_id uuid, p_company uuid, p_kind text, p_date date, p_invoice_no text, p_party uuid,
  p_party_gstin text, p_pos text, p_supply text, p_due date, p_ref text, p_narration text,
  p_lines jsonb, p_ledgers jsonb, p_round boolean default true
) returns uuid as $$
declare
  v_fy text := acc_fy(p_date); v_start date; v_inv uuid := p_id; v_vid uuid; v_no text; v_prefix text;
  v_old_fy text; b record; x jsonb;
  v_taxable numeric := 0; v_cgst numeric := 0; v_sgst numeric := 0; v_igst numeric := 0;
  v_total numeric; v_round numeric := 0; v_e jsonb := '[]'::jsonb;
  v_main uuid := (p_ledgers->>'main')::uuid; v_lc uuid := (p_ledgers->>'cgst')::uuid;
  v_ls uuid := (p_ledgers->>'sgst')::uuid; v_li uuid := (p_ledgers->>'igst')::uuid; v_lr uuid := (p_ledgers->>'round')::uuid;
begin
  if p_kind not in ('Sales','Purchase') then raise exception 'Unknown invoice type'; end if;
  if p_supply not in ('Intra','Inter') then raise exception 'Choose same-state or other-state supply'; end if;
  if coalesce(trim(p_invoice_no), '') = '' then raise exception 'Invoice number is required'; end if;
  if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) < 1 then raise exception 'Add at least one item'; end if;
  if not exists (select 1 from acc_ledgers where id = p_party and company_id = p_company) then raise exception 'Choose the party'; end if;
  select books_start into v_start from acc_settings where company_id = p_company;
  if v_start is not null and p_date < v_start then raise exception 'Date is before the books start date (%)', v_start; end if;

  for x in select * from jsonb_array_elements(p_lines) loop
    if coalesce(trim(x->>'description'), '') = '' then raise exception 'Every item needs a description'; end if;
    if coalesce((x->>'qty')::numeric, 0) <= 0 then raise exception 'Every item needs a quantity above zero'; end if;
  end loop;

  for b in
    select gst, sum(t) as tx from (
      select coalesce((e->>'gst_rate')::numeric, 0) as gst,
             round(coalesce((e->>'qty')::numeric, 0) * coalesce((e->>'rate')::numeric, 0) * (1 - coalesce((e->>'discount_pct')::numeric, 0) / 100), 2) as t
      from jsonb_array_elements(p_lines) e) s group by gst
  loop
    v_taxable := v_taxable + b.tx;
    if p_supply = 'Intra' then
      v_cgst := v_cgst + round(b.tx * b.gst / 200, 2);
      v_sgst := v_sgst + round(b.tx * b.gst / 200, 2);
    else
      v_igst := v_igst + round(b.tx * b.gst / 100, 2);
    end if;
  end loop;
  if v_taxable <= 0 then raise exception 'Invoice value must be above zero'; end if;

  v_total := v_taxable + v_cgst + v_sgst + v_igst;
  if p_round then v_round := round(v_total) - v_total; v_total := v_total + v_round; end if;

  if v_main is null or not exists (select 1 from acc_ledgers where id = v_main and company_id = p_company) then raise exception 'Sales / purchase ledger is missing'; end if;
  if (v_cgst > 0 and v_lc is null) or (v_sgst > 0 and v_ls is null) or (v_igst > 0 and v_li is null) or (v_round <> 0 and v_lr is null) then
    raise exception 'A GST / round-off ledger is missing';
  end if;

  v_prefix := case p_kind when 'Sales' then 'SAL' else 'PUR' end;

  if v_inv is not null then
    select voucher_id into v_vid from acc_invoices where id = v_inv and company_id = p_company and kind = p_kind;
    if v_vid is null then raise exception 'Invoice not found'; end if;
    select fy into v_old_fy from acc_vouchers where id = v_vid;
    if v_old_fy = v_fy then
      update acc_vouchers set voucher_date = p_date, narration = p_narration where id = v_vid;
    else
      select v_prefix || '-' || lpad((coalesce(max((regexp_replace(voucher_no, '^.*-', ''))::int), 0) + 1)::text, 4, '0')
        into v_no from acc_vouchers where company_id = p_company and voucher_type = p_kind and fy = v_fy;
      update acc_vouchers set voucher_no = v_no, fy = v_fy, voucher_date = p_date, narration = p_narration where id = v_vid;
    end if;
    delete from acc_entries where voucher_id = v_vid;
    delete from acc_invoice_lines where invoice_id = v_inv;
    update acc_invoices set fy = v_fy, invoice_no = trim(p_invoice_no), invoice_date = p_date, due_date = p_due,
      party_ledger_id = p_party, party_gstin = nullif(trim(p_party_gstin), ''), place_of_supply = nullif(trim(p_pos), ''),
      supply_type = p_supply, reference = nullif(trim(p_ref), ''), narration = nullif(trim(p_narration), ''),
      taxable = v_taxable, cgst = v_cgst, sgst = v_sgst, igst = v_igst, round_off = v_round, total = v_total
    where id = v_inv;
  else
    select v_prefix || '-' || lpad((coalesce(max((regexp_replace(voucher_no, '^.*-', ''))::int), 0) + 1)::text, 4, '0')
      into v_no from acc_vouchers where company_id = p_company and voucher_type = p_kind and fy = v_fy;
    insert into acc_vouchers (company_id, voucher_type, voucher_no, voucher_date, fy, narration)
    values (p_company, p_kind, v_no, p_date, v_fy, p_narration) returning id into v_vid;
    insert into acc_invoices (company_id, kind, voucher_id, fy, invoice_no, invoice_date, due_date, party_ledger_id, party_gstin,
      place_of_supply, supply_type, reference, narration, taxable, cgst, sgst, igst, round_off, total)
    values (p_company, p_kind, v_vid, v_fy, trim(p_invoice_no), p_date, p_due, p_party, nullif(trim(p_party_gstin), ''),
      nullif(trim(p_pos), ''), p_supply, nullif(trim(p_ref), ''), nullif(trim(p_narration), ''), v_taxable, v_cgst, v_sgst, v_igst, v_round, v_total)
    returning id into v_inv;
  end if;

  insert into acc_invoice_lines (invoice_id, line_no, description, hsn, qty, uom, rate, discount_pct, gst_rate, taxable)
  select v_inv, ord, trim(e->>'description'), nullif(trim(e->>'hsn'), ''), (e->>'qty')::numeric, nullif(trim(e->>'uom'), ''),
         coalesce((e->>'rate')::numeric, 0), coalesce((e->>'discount_pct')::numeric, 0), coalesce((e->>'gst_rate')::numeric, 0),
         round(coalesce((e->>'qty')::numeric, 0) * coalesce((e->>'rate')::numeric, 0) * (1 - coalesce((e->>'discount_pct')::numeric, 0) / 100), 2)
  from jsonb_array_elements(p_lines) with ordinality as t(e, ord);

  -- Voucher entries. Sales: party debit, sales + output tax credit. Purchase: the mirror image.
  if p_kind = 'Sales' then
    v_e := v_e || jsonb_build_object('l', p_party, 'd', v_total, 'c', 0);
    v_e := v_e || jsonb_build_object('l', v_main, 'd', 0, 'c', v_taxable);
    if v_cgst > 0 then v_e := v_e || jsonb_build_object('l', v_lc, 'd', 0, 'c', v_cgst); end if;
    if v_sgst > 0 then v_e := v_e || jsonb_build_object('l', v_ls, 'd', 0, 'c', v_sgst); end if;
    if v_igst > 0 then v_e := v_e || jsonb_build_object('l', v_li, 'd', 0, 'c', v_igst); end if;
    if v_round > 0 then v_e := v_e || jsonb_build_object('l', v_lr, 'd', 0, 'c', v_round); end if;
    if v_round < 0 then v_e := v_e || jsonb_build_object('l', v_lr, 'd', -v_round, 'c', 0); end if;
  else
    v_e := v_e || jsonb_build_object('l', p_party, 'd', 0, 'c', v_total);
    v_e := v_e || jsonb_build_object('l', v_main, 'd', v_taxable, 'c', 0);
    if v_cgst > 0 then v_e := v_e || jsonb_build_object('l', v_lc, 'd', v_cgst, 'c', 0); end if;
    if v_sgst > 0 then v_e := v_e || jsonb_build_object('l', v_ls, 'd', v_sgst, 'c', 0); end if;
    if v_igst > 0 then v_e := v_e || jsonb_build_object('l', v_li, 'd', v_igst, 'c', 0); end if;
    if v_round > 0 then v_e := v_e || jsonb_build_object('l', v_lr, 'd', v_round, 'c', 0); end if;
    if v_round < 0 then v_e := v_e || jsonb_build_object('l', v_lr, 'd', 0, 'c', -v_round); end if;
  end if;

  insert into acc_entries (voucher_id, ledger_id, debit, credit, line_no)
  select v_vid, (e->>'l')::uuid, (e->>'d')::numeric, (e->>'c')::numeric, ord
  from jsonb_array_elements(v_e) with ordinality as t(e, ord);

  return v_inv;
end;
$$ language plpgsql;

grant execute on function acc_save_invoice(uuid, uuid, text, date, text, uuid, text, text, text, date, text, text, jsonb, jsonb, boolean) to authenticated;
notify pgrst, 'reload schema';
