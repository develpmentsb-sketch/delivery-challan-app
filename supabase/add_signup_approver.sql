-- Lets an admin mark selected users as "Manager": they can approve new sign-ups
-- (activate a pending account and set it to Operator or Viewer), and nothing else.
-- Managers cannot change roles, deactivate, delete users or edit other managers.
-- Run once in Supabase > SQL Editor.

alter table profiles add column if not exists can_approve boolean not null default false;

-- True for an active admin or an active manager (SECURITY DEFINER avoids policy recursion).
create or replace function is_signup_approver() returns boolean
language plpgsql security definer stable set search_path = public as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid() and is_active and (role = 'admin' or can_approve)
  );
end;
$$;

-- Managers may READ the user list (needed to see who is pending).
drop policy if exists "profiles_approver_select" on profiles;
create policy "profiles_approver_select" on profiles
  for select to authenticated using (is_signup_approver());

-- Only an admin may grant or remove the manager flag (nobody can give it to themselves).
create or replace function guard_profile_can_approve() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.can_approve is distinct from old.can_approve
     and auth.uid() is not null
     and not exists (select 1 from profiles where id = auth.uid() and role = 'admin' and is_active) then
    raise exception 'Only an admin can change manager access';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_can_approve on profiles;
create trigger profiles_guard_can_approve
  before update on profiles
  for each row execute function guard_profile_can_approve();

-- The one action a manager can do: approve a pending user (optionally choose their role).
create or replace function approve_user(target_id uuid, new_role text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_signup_approver() then
    raise exception 'Only an admin or manager can approve users';
  end if;
  if new_role is not null and new_role not in ('user', 'viewer') then
    raise exception 'Role must be Operator or Viewer';
  end if;
  update profiles
     set is_active = true, role = coalesce(new_role, role)
   where id = target_id and role <> 'admin' and is_active = false;
  if not found then
    raise exception 'User not found or already approved';
  end if;
end;
$$;

revoke all on function approve_user(uuid, text) from public, anon;
grant execute on function approve_user(uuid, text) to authenticated;
