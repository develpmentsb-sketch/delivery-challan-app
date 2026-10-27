-- =====================================================================
-- Ledger Master + Chart of Accounts  (Business Master - Phase 3)
-- Run this ONCE in the Supabase SQL editor. Safe to re-run.
--
-- Creates:  account_groups, chart_of_accounts (the ledgers),
--           ledger_bank_details (admin-only), audit_logs (if missing)
-- Adds:     duplicate-code protection, group hierarchy checks,
--           delete protection for used ledgers, audit trail, RLS.
-- Needs:    the existing `profiles` table (id, role, is_active).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

-- Role of the signed-in user ('admin' | 'user' | 'viewer'); NULL when the
-- user has no profile or the account is inactive.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public.profiles where id = auth.uid() and is_active
$$;

revoke all on function public.app_role() from public;
grant execute on function public.app_role() to authenticated;

create or replace function public.ledger_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Audit log (shared by all master tables; created only if missing)
-- ---------------------------------------------------------------------
create table if not exists audit_logs (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz not null default now()
);

create index if not exists audit_logs_record_idx on audit_logs (table_name, record_id, changed_at desc);

alter table audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on audit_logs;
create policy "audit_logs_select_admin" on audit_logs
  for select using (public.app_role() = 'admin');
-- No insert/update/delete policies: rows are written only by the trigger below.

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_row jsonb;
  v_id uuid;
begin
  select email into v_email from auth.users where id = auth.uid();

  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_id := coalesce(v_row ->> 'id', v_row ->> 'ledger_id')::uuid;

  if tg_op = 'INSERT' then
    insert into audit_logs (table_name, record_id, action, new_data, changed_by, changed_by_email)
    values (tg_table_name, v_id, 'INSERT', to_jsonb(new), auth.uid(), v_email);
    return new;
  elsif tg_op = 'UPDATE' then
    -- ignore updates that only touch the updated_at stamp
    if (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
      return new;
    end if;
    insert into audit_logs (table_name, record_id, action, old_data, new_data, changed_by, changed_by_email)
    values (tg_table_name, v_id, 'UPDATE', to_jsonb(old), to_jsonb(new), auth.uid(), v_email);
    return new;
  else
    insert into audit_logs (table_name, record_id, action, old_data, changed_by, changed_by_email)
    values (tg_table_name, v_id, 'DELETE', to_jsonb(old), auth.uid(), v_email);
    return old;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. account_groups : hierarchical groups (never posted to directly)
-- ---------------------------------------------------------------------
create table if not exists account_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  parent_id uuid references account_groups(id) on delete restrict,
  account_type text not null check (account_type in ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
  sort_order integer not null default 0,
  is_system boolean not null default false,
  active boolean not null default true,
  remarks text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_groups_name_not_blank check (length(btrim(name)) > 0),
  constraint account_groups_code_not_blank check (length(btrim(code)) > 0)
);

create unique index if not exists account_groups_code_uidx on account_groups (upper(code));
create unique index if not exists account_groups_sibling_name_uidx
  on account_groups (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists account_groups_parent_idx on account_groups (parent_id);

-- ---------------------------------------------------------------------
-- 3. chart_of_accounts : the ledgers (the only accounts you can post to)
-- ---------------------------------------------------------------------
create table if not exists chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  ledger_code text not null,
  ledger_name text not null,
  group_id uuid not null references account_groups(id) on delete restrict,
  account_type text not null check (account_type in ('Asset', 'Liability', 'Equity', 'Income', 'Expense')),
  account_subgroup text,
  opening_balance numeric(16, 2) not null default 0 check (opening_balance >= 0),
  balance_type text not null default 'Debit' check (balance_type in ('Debit', 'Credit')),
  effective_date date,
  gst_applicable boolean not null default false,
  gst_tax_category text,
  is_bank_account boolean not null default false,
  cost_centre_applicable boolean not null default false,
  active boolean not null default true,
  is_system boolean not null default false,
  remarks text,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_of_accounts_code_not_blank check (length(btrim(ledger_code)) > 0),
  constraint chart_of_accounts_name_not_blank check (length(btrim(ledger_name)) > 0),
  -- an opening balance must be dated so it lands in the right financial year
  constraint chart_of_accounts_opening_dated check (opening_balance = 0 or effective_date is not null),
  constraint chart_of_accounts_gst_category check (not gst_applicable or coalesce(gst_tax_category, '') <> '')
);

create unique index if not exists chart_of_accounts_code_uidx on chart_of_accounts (upper(ledger_code));
create unique index if not exists chart_of_accounts_group_name_uidx on chart_of_accounts (group_id, lower(ledger_name));
create index if not exists chart_of_accounts_group_idx on chart_of_accounts (group_id);

-- ---------------------------------------------------------------------
-- 4. ledger_bank_details : sensitive bank data, readable by admins only
-- ---------------------------------------------------------------------
create table if not exists ledger_bank_details (
  ledger_id uuid primary key references chart_of_accounts(id) on delete cascade,
  bank_name text not null,
  branch_name text,
  account_holder text,
  account_number text,
  ifsc text,
  account_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ledger_bank_ifsc_format check (ifsc is null or ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  constraint ledger_bank_account_format check (account_number is null or account_number ~ '^[0-9]{9,18}$')
);

-- ---------------------------------------------------------------------
-- 5. Usage check: is a ledger referenced by any other record?
--    It looks at every foreign key that points at chart_of_accounts, so
--    any future table (vouchers, invoices, partner links...) that
--    references a ledger automatically makes it "used" - no code change.
--    FKs with ON DELETE CASCADE are treated as the ledger's own detail
--    rows (e.g. ledger_bank_details) and are ignored.
-- ---------------------------------------------------------------------
create or replace function public.ledger_is_used(p_ledger uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  v_used boolean;
begin
  for r in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and c.confrelid = 'public.chart_of_accounts'::regclass
      and array_length(c.conkey, 1) = 1
      and c.confdeltype <> 'c'
  loop
    execute format('select exists (select 1 from %s where %I = $1)', r.tbl, r.col)
      into v_used using p_ledger;
    if v_used then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

revoke all on function public.ledger_is_used(uuid) from public;
grant execute on function public.ledger_is_used(uuid) to authenticated;

-- Call this from any future posting code (voucher / invoice tables) to be
-- sure an entry only ever lands on an existing, active ledger. Groups live
-- in a different table, so they can never be posted to.
create or replace function public.assert_postable_ledger(p_ledger uuid)
returns void
language plpgsql
stable
as $$
begin
  if not exists (select 1 from public.chart_of_accounts where id = p_ledger and active) then
    raise exception 'Entries can only be posted to an active ledger.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Guards
-- ---------------------------------------------------------------------

-- 6a. account_groups: tidy codes, enforce hierarchy, keep type consistent
create or replace function public.account_groups_guard()
returns trigger
language plpgsql
as $$
declare
  v_parent_type text;
  v_has_children boolean;
  v_has_ledgers boolean;
begin
  new.code := upper(btrim(new.code));
  new.name := btrim(new.name);

  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'A group cannot be its own parent.';
    end if;

    select account_type into v_parent_type from account_groups where id = new.parent_id;
    if v_parent_type is null then
      raise exception 'The parent group does not exist.';
    end if;
    -- sub-groups always inherit the account type of the parent
    new.account_type := v_parent_type;

    if tg_op = 'UPDATE' then
      -- the new parent must not be this group or one of its own descendants
      if exists (
        with recursive up as (
          select id, parent_id from account_groups where id = new.parent_id
          union all
          select g.id, g.parent_id from account_groups g join up on g.id = up.parent_id
        )
        select 1 from up where id = new.id
      ) then
        raise exception 'A group cannot be moved under itself or one of its own sub-groups.';
      end if;
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.is_system and (new.code <> old.code
                          or new.account_type <> old.account_type
                          or new.parent_id is distinct from old.parent_id) then
      raise exception 'The code, type and position of a standard group cannot be changed.';
    end if;

    if new.account_type <> old.account_type then
      select exists (select 1 from account_groups where parent_id = old.id) into v_has_children;
      select exists (select 1 from chart_of_accounts where group_id = old.id) into v_has_ledgers;
      if v_has_children or v_has_ledgers then
        raise exception 'The account type of a group that already has sub-groups or ledgers cannot be changed.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists account_groups_guard_trg on account_groups;
create trigger account_groups_guard_trg
  before insert or update on account_groups
  for each row execute function public.account_groups_guard();

create or replace function public.account_groups_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'Standard groups cannot be deleted. You can deactivate it instead.';
  end if;
  if exists (select 1 from account_groups where parent_id = old.id) then
    raise exception 'This group cannot be deleted because it has sub-groups. Move or delete them first, or deactivate the group.';
  end if;
  if exists (select 1 from chart_of_accounts where group_id = old.id) then
    raise exception 'This group cannot be deleted because it contains ledgers. Move the ledgers first, or deactivate the group.';
  end if;
  return old;
end;
$$;

drop trigger if exists account_groups_delete_guard_trg on account_groups;
create trigger account_groups_delete_guard_trg
  before delete on account_groups
  for each row execute function public.account_groups_delete_guard();

-- 6b. chart_of_accounts: tidy codes, derive type from the group
create or replace function public.chart_of_accounts_guard()
returns trigger
language plpgsql
as $$
declare
  v_type text;
  v_active boolean;
begin
  new.ledger_code := upper(btrim(new.ledger_code));
  new.ledger_name := btrim(new.ledger_name);

  select account_type, active into v_type, v_active from account_groups where id = new.group_id;
  if v_type is null then
    raise exception 'Please choose an account group for this ledger.';
  end if;

  if tg_op = 'INSERT' then
    if not v_active then
      raise exception 'This ledger cannot be placed in an inactive group.';
    end if;
  elsif new.group_id is distinct from old.group_id then
    if not v_active then
      raise exception 'This ledger cannot be placed in an inactive group.';
    end if;
  end if;

  new.account_type := v_type;

  if tg_op = 'UPDATE' then
    if old.is_system and (new.ledger_code <> old.ledger_code or new.group_id <> old.group_id) then
      raise exception 'The code and group of a standard ledger cannot be changed.';
    end if;
    -- a ledger that already has transactions must stay in the same type of account
    if new.account_type <> old.account_type and public.ledger_is_used(old.id) then
      raise exception 'This ledger is already used in transactions, so it cannot be moved to a group of a different account type.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chart_of_accounts_guard_trg on chart_of_accounts;
create trigger chart_of_accounts_guard_trg
  before insert or update on chart_of_accounts
  for each row execute function public.chart_of_accounts_guard();

-- 6c. never delete a ledger that is referenced elsewhere
create or replace function public.chart_of_accounts_delete_guard()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'Standard ledgers cannot be deleted. You can deactivate it instead.';
  end if;
  if public.ledger_is_used(old.id) then
    raise exception 'This ledger is used in transactions or linked to other records, so it cannot be deleted. Deactivate it instead.';
  end if;
  return old;
end;
$$;

drop trigger if exists chart_of_accounts_delete_guard_trg on chart_of_accounts;
create trigger chart_of_accounts_delete_guard_trg
  before delete on chart_of_accounts
  for each row execute function public.chart_of_accounts_delete_guard();

-- 6d. timestamps + audit trail
drop trigger if exists account_groups_updated_at_trg on account_groups;
create trigger account_groups_updated_at_trg before update on account_groups
  for each row execute function public.ledger_set_updated_at();

drop trigger if exists chart_of_accounts_updated_at_trg on chart_of_accounts;
create trigger chart_of_accounts_updated_at_trg before update on chart_of_accounts
  for each row execute function public.ledger_set_updated_at();

drop trigger if exists ledger_bank_details_updated_at_trg on ledger_bank_details;
create trigger ledger_bank_details_updated_at_trg before update on ledger_bank_details
  for each row execute function public.ledger_set_updated_at();

drop trigger if exists account_groups_audit_trg on account_groups;
create trigger account_groups_audit_trg after insert or update or delete on account_groups
  for each row execute function public.audit_row_change();

drop trigger if exists chart_of_accounts_audit_trg on chart_of_accounts;
create trigger chart_of_accounts_audit_trg after insert or update or delete on chart_of_accounts
  for each row execute function public.audit_row_change();

drop trigger if exists ledger_bank_details_audit_trg on ledger_bank_details;
create trigger ledger_bank_details_audit_trg after insert or update or delete on ledger_bank_details
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- 7. Row Level Security
--    viewer  : read only
--    user    : read + create/edit ledgers
--    admin   : everything (groups, delete, bank details)
-- ---------------------------------------------------------------------
alter table account_groups enable row level security;
alter table chart_of_accounts enable row level security;
alter table ledger_bank_details enable row level security;

drop policy if exists "groups_select" on account_groups;
drop policy if exists "groups_insert" on account_groups;
drop policy if exists "groups_update" on account_groups;
drop policy if exists "groups_delete" on account_groups;
create policy "groups_select" on account_groups for select using (public.app_role() is not null);
create policy "groups_insert" on account_groups for insert with check (public.app_role() = 'admin');
create policy "groups_update" on account_groups for update using (public.app_role() = 'admin') with check (public.app_role() = 'admin');
create policy "groups_delete" on account_groups for delete using (public.app_role() = 'admin');

drop policy if exists "ledgers_select" on chart_of_accounts;
drop policy if exists "ledgers_insert" on chart_of_accounts;
drop policy if exists "ledgers_update" on chart_of_accounts;
drop policy if exists "ledgers_delete" on chart_of_accounts;
create policy "ledgers_select" on chart_of_accounts for select using (public.app_role() is not null);
create policy "ledgers_insert" on chart_of_accounts for insert with check (public.app_role() in ('admin', 'user'));
create policy "ledgers_update" on chart_of_accounts for update
  using (public.app_role() in ('admin', 'user')) with check (public.app_role() in ('admin', 'user'));
create policy "ledgers_delete" on chart_of_accounts for delete using (public.app_role() = 'admin');

drop policy if exists "ledger_bank_all" on ledger_bank_details;
create policy "ledger_bank_all" on ledger_bank_details for all
  using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- ---------------------------------------------------------------------
-- 8. Standard Indian chart-of-accounts groups (structure only, no ledgers)
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('AST',      'Assets',                    'Asset',     null::text, 10),
      ('AST-CA',   'Current Assets',            'Asset',     'AST',      11),
      ('AST-CASH', 'Cash-in-Hand',              'Asset',     'AST-CA',   12),
      ('AST-BANK', 'Bank Accounts',             'Asset',     'AST-CA',   13),
      ('AST-DEBT', 'Sundry Debtors',            'Asset',     'AST-CA',   14),
      ('AST-STK',  'Stock-in-Hand',             'Asset',     'AST-CA',   15),
      ('AST-ADV',  'Loans & Advances (Asset)',  'Asset',     'AST-CA',   16),
      ('AST-DEP',  'Deposits (Asset)',          'Asset',     'AST-CA',   17),
      ('AST-FA',   'Fixed Assets',              'Asset',     'AST',      18),
      ('AST-INV',  'Investments',               'Asset',     'AST',      19),
      ('LIA',      'Liabilities',               'Liability', null,       20),
      ('LIA-CL',   'Current Liabilities',       'Liability', 'LIA',      21),
      ('LIA-CRED', 'Sundry Creditors',          'Liability', 'LIA-CL',   22),
      ('LIA-TAX',  'Duties & Taxes',            'Liability', 'LIA-CL',   23),
      ('LIA-PROV', 'Provisions',                'Liability', 'LIA-CL',   24),
      ('LIA-LOAN', 'Loans (Liability)',         'Liability', 'LIA',      25),
      ('LIA-SEC',  'Secured Loans',             'Liability', 'LIA-LOAN', 26),
      ('LIA-UNS',  'Unsecured Loans',           'Liability', 'LIA-LOAN', 27),
      ('EQT',      'Equity',                    'Equity',    null,       30),
      ('EQT-CAP',  'Capital Account',           'Equity',    'EQT',      31),
      ('EQT-RES',  'Reserves & Surplus',        'Equity',    'EQT',      32),
      ('INC',      'Income',                    'Income',    null,       40),
      ('INC-SALES','Sales Accounts',            'Income',    'INC',      41),
      ('INC-DIR',  'Direct Incomes',            'Income',    'INC',      42),
      ('INC-IND',  'Indirect Incomes',          'Income',    'INC',      43),
      ('EXP',      'Expenses',                  'Expense',   null,       50),
      ('EXP-PUR',  'Purchase Accounts',         'Expense',   'EXP',      51),
      ('EXP-DIR',  'Direct Expenses',           'Expense',   'EXP',      52),
      ('EXP-IND',  'Indirect Expenses',         'Expense',   'EXP',      53)
    ) as t(code, name, account_type, parent_code, sort_order)
  loop
    insert into account_groups (code, name, account_type, parent_id, sort_order, is_system)
    values (
      r.code, r.name, r.account_type,
      (select id from account_groups where code = r.parent_code),
      r.sort_order, true
    )
    on conflict do nothing;
  end loop;
end;
$$;

-- Make the new tables visible to the Supabase API straight away
-- (avoids the "could not find the table/column in the schema cache" error).
notify pgrst, 'reload schema';
