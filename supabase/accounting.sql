-- =====================================================================
-- ACCOUNTING MODULE (stage 1): groups, ledgers, vouchers, reports.
-- One set of books per company (company_locations). Run ONCE in the
-- Supabase SQL Editor. Safe to run again.
-- =====================================================================

create table if not exists acc_settings (
  company_id uuid primary key references company_locations(id) on delete cascade,
  books_start date not null default date '2026-04-01',
  created_at timestamptz not null default now()
);

create table if not exists acc_groups (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_locations(id) on delete cascade,
  name text not null,
  parent_id uuid references acc_groups(id) on delete restrict,
  nature text not null check (nature in ('Asset','Liability','Income','Expense')),
  sched3 text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);

create table if not exists acc_ledgers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_locations(id) on delete cascade,
  name text not null,
  group_id uuid not null references acc_groups(id) on delete restrict,
  opening_balance numeric(16,2) not null default 0 check (opening_balance >= 0),
  opening_type text not null default 'Dr' check (opening_type in ('Dr','Cr')),
  partner_id uuid references partners(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists acc_ledgers_company_idx on acc_ledgers (company_id);

create table if not exists acc_vouchers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_locations(id) on delete cascade,
  voucher_type text not null check (voucher_type in ('Payment','Receipt','Journal','Contra')),
  voucher_no text not null,
  voucher_date date not null,
  fy text not null,
  narration text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (company_id, voucher_type, fy, voucher_no)
);
create index if not exists acc_vouchers_company_date_idx on acc_vouchers (company_id, voucher_date);

create table if not exists acc_entries (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references acc_vouchers(id) on delete cascade,
  ledger_id uuid not null references acc_ledgers(id) on delete restrict,
  debit numeric(16,2) not null default 0 check (debit >= 0),
  credit numeric(16,2) not null default 0 check (credit >= 0),
  line_no int not null default 1,
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);
create index if not exists acc_entries_voucher_idx on acc_entries (voucher_id);
create index if not exists acc_entries_ledger_idx on acc_entries (ledger_id);

create table if not exists acc_stock_values (
  company_id uuid not null references company_locations(id) on delete cascade,
  fy text not null,
  closing_stock numeric(16,2) not null default 0 check (closing_stock >= 0),
  primary key (company_id, fy)
);

-- ---------- Security: same roles as the rest of the app ----------
do $$
declare t text;
begin
  foreach t in array array['acc_settings','acc_groups','acc_ledgers','acc_vouchers','acc_entries','acc_stock_values'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_sel', t);
    execute format('drop policy if exists %I on %I', t || '_ins', t);
    execute format('drop policy if exists %I on %I', t || '_upd', t);
    execute format('drop policy if exists %I on %I', t || '_del', t);
    execute format('create policy %I on %I for select using (app_role() is not null)', t || '_sel', t);
    execute format('create policy %I on %I for insert with check (app_role() in (''admin'',''user''))', t || '_ins', t);
    execute format('create policy %I on %I for update using (app_role() in (''admin'',''user'')) with check (app_role() in (''admin'',''user''))', t || '_upd', t);
    -- only an admin deletes vouchers / ledgers / groups; entries may be replaced by operators when a voucher is edited
    if t = 'acc_entries' or t = 'acc_stock_values' then
      execute format('create policy %I on %I for delete using (app_role() in (''admin'',''user''))', t || '_del', t);
    else
      execute format('create policy %I on %I for delete using (app_role() = ''admin'')', t || '_del', t);
    end if;
    execute format('grant select, insert, update, delete on table %I to authenticated', t);
    execute format('grant select, insert, update, delete on table %I to service_role', t);
  end loop;
end $$;

-- ---------- Financial year label, e.g. 2026-27 ----------
create or replace function acc_fy(d date) returns text as $$
  select case when extract(month from d) >= 4
    then extract(year from d)::int || '-' || right((extract(year from d)::int + 1)::text, 2)
    else (extract(year from d)::int - 1) || '-' || right(extract(year from d)::int::text, 2) end;
$$ language sql immutable;

-- ---------- Standard Tally-style groups for a company ----------
create or replace function acc_seed_company(p_company uuid, p_books_start date default null)
returns void as $$
declare r record;
begin
  insert into acc_settings (company_id, books_start)
  values (p_company, coalesce(p_books_start, date '2026-04-01'))
  on conflict (company_id) do update set books_start = coalesce(p_books_start, acc_settings.books_start);

  if exists (select 1 from acc_groups where company_id = p_company) then return; end if;

  insert into acc_groups (company_id, name, nature, sched3, is_system)
  select p_company, n, nat, s, true from (values
    ('Capital Account','Liability','share_capital'),
    ('Loans (Liability)','Liability','st_borrowings'),
    ('Current Liabilities','Liability','other_cl'),
    ('Fixed Assets','Asset','ppe'),
    ('Investments','Asset','nc_investments'),
    ('Current Assets','Asset','other_ca'),
    ('Misc. Expenses (ASSET)','Asset','other_ca'),
    ('Suspense A/c','Liability','other_cl'),
    ('Sales Accounts','Income',null),
    ('Purchase Accounts','Expense',null),
    ('Direct Incomes','Income',null),
    ('Direct Expenses','Expense',null),
    ('Indirect Incomes','Income',null),
    ('Indirect Expenses','Expense',null)
  ) as v(n, nat, s);

  for r in select * from (values
    ('Reserves & Surplus','Capital Account','Liability','reserves'),
    ('Bank OD A/c','Loans (Liability)','Liability','st_borrowings'),
    ('Secured Loans','Loans (Liability)','Liability','lt_borrowings'),
    ('Unsecured Loans','Loans (Liability)','Liability','lt_borrowings'),
    ('Duties & Taxes','Current Liabilities','Liability','other_cl'),
    ('Provisions','Current Liabilities','Liability','st_provisions'),
    ('Sundry Creditors','Current Liabilities','Liability','trade_payables'),
    ('Bank Accounts','Current Assets','Asset','cash_bank'),
    ('Cash-in-Hand','Current Assets','Asset','cash_bank'),
    ('Deposits (Asset)','Current Assets','Asset','lt_loans_adv'),
    ('Loans & Advances (Asset)','Current Assets','Asset','st_loans_adv'),
    ('Stock-in-Hand','Current Assets','Asset','inventories'),
    ('Sundry Debtors','Current Assets','Asset','trade_receivables')
  ) as v(n, parent, nat, s) loop
    insert into acc_groups (company_id, name, parent_id, nature, sched3, is_system)
    select p_company, r.n, g.id, r.nat, r.s, true from acc_groups g where g.company_id = p_company and g.name = r.parent;
  end loop;

  insert into acc_ledgers (company_id, name, group_id)
  select p_company, 'Cash', id from acc_groups where company_id = p_company and name = 'Cash-in-Hand'
  on conflict do nothing;
end;
$$ language plpgsql;

-- ---------- Save a voucher (new or edit) in one step, checking Dr = Cr ----------
create or replace function acc_save_voucher(
  p_id uuid, p_company uuid, p_type text, p_date date, p_narration text, p_entries jsonb
) returns uuid as $$
declare
  v_id uuid := p_id; v_fy text := acc_fy(p_date); v_no text; v_old_fy text; v_old_type text;
  v_dr numeric := 0; v_cr numeric := 0; v_n int := 0; e jsonb; v_prefix text; v_start date;
begin
  if p_type not in ('Payment','Receipt','Journal','Contra') then raise exception 'Unknown voucher type'; end if;
  if jsonb_array_length(coalesce(p_entries,'[]'::jsonb)) < 2 then raise exception 'A voucher needs at least two lines'; end if;
  for e in select * from jsonb_array_elements(p_entries) loop
    v_dr := v_dr + coalesce((e->>'debit')::numeric,0);
    v_cr := v_cr + coalesce((e->>'credit')::numeric,0);
    if not exists (select 1 from acc_ledgers where id = (e->>'ledger_id')::uuid and company_id = p_company) then
      raise exception 'A ledger does not belong to this company';
    end if;
  end loop;
  if round(v_dr,2) <> round(v_cr,2) or v_dr = 0 then raise exception 'Debit (%) and credit (%) must be equal', v_dr, v_cr; end if;
  select books_start into v_start from acc_settings where company_id = p_company;
  if v_start is not null and p_date < v_start then raise exception 'Date is before the books start date (%)', v_start; end if;

  v_prefix := case p_type when 'Payment' then 'PMT' when 'Receipt' then 'RCT' when 'Journal' then 'JV' else 'CNT' end;

  if v_id is not null then
    select fy, voucher_type into v_old_fy, v_old_type from acc_vouchers where id = v_id and company_id = p_company;
    if not found then raise exception 'Voucher not found'; end if;
    if v_old_fy = v_fy and v_old_type = p_type then
      update acc_vouchers set voucher_date = p_date, narration = p_narration where id = v_id;
    else
      select v_prefix || '-' || lpad((coalesce(max((regexp_replace(voucher_no, '^.*-', ''))::int),0) + 1)::text, 4, '0')
        into v_no from acc_vouchers where company_id = p_company and voucher_type = p_type and fy = v_fy;
      update acc_vouchers set voucher_type = p_type, voucher_no = v_no, fy = v_fy, voucher_date = p_date, narration = p_narration where id = v_id;
    end if;
    delete from acc_entries where voucher_id = v_id;
  else
    select v_prefix || '-' || lpad((coalesce(max((regexp_replace(voucher_no, '^.*-', ''))::int),0) + 1)::text, 4, '0')
      into v_no from acc_vouchers where company_id = p_company and voucher_type = p_type and fy = v_fy;
    insert into acc_vouchers (company_id, voucher_type, voucher_no, voucher_date, fy, narration)
    values (p_company, p_type, v_no, p_date, v_fy, p_narration) returning id into v_id;
  end if;

  for e in select * from jsonb_array_elements(p_entries) loop
    v_n := v_n + 1;
    insert into acc_entries (voucher_id, ledger_id, debit, credit, line_no)
    values (v_id, (e->>'ledger_id')::uuid, coalesce((e->>'debit')::numeric,0), coalesce((e->>'credit')::numeric,0), v_n);
  end loop;
  return v_id;
end;
$$ language plpgsql;

-- ---------- Ledger totals for the reports ----------
-- pre_* = before p_from, per_* = from p_from to p_to
create or replace function acc_ledger_totals(p_company uuid, p_from date, p_to date)
returns table (ledger_id uuid, pre_debit numeric, pre_credit numeric, per_debit numeric, per_credit numeric) as $$
  select e.ledger_id,
    coalesce(sum(e.debit)  filter (where v.voucher_date <  p_from), 0),
    coalesce(sum(e.credit) filter (where v.voucher_date <  p_from), 0),
    coalesce(sum(e.debit)  filter (where v.voucher_date >= p_from and v.voucher_date <= p_to), 0),
    coalesce(sum(e.credit) filter (where v.voucher_date >= p_from and v.voucher_date <= p_to), 0)
  from acc_entries e join acc_vouchers v on v.id = e.voucher_id
  where v.company_id = p_company and v.voucher_date <= p_to
  group by e.ledger_id;
$$ language sql stable;

grant execute on function acc_fy(date) to authenticated;
grant execute on function acc_seed_company(uuid, date) to authenticated;
grant execute on function acc_save_voucher(uuid, uuid, text, date, text, jsonb) to authenticated;
grant execute on function acc_ledger_totals(uuid, date, date) to authenticated;

notify pgrst, 'reload schema';
