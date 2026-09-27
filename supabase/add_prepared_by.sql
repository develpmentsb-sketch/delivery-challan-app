-- =====================================================================
-- "Prepared By" for the Master List Report
-- Run this ONCE in the Supabase SQL editor.
--
-- Rather than joining delivery_challans.created_by -> profiles at report
-- time (which needs every user to be able to read every other user's
-- profile row), we snapshot the preparer's display name onto the challan
-- itself at creation time - the same pattern already used for
-- dispatch_from_snapshot / bill_to_snapshot / ship_to_snapshot. Old
-- challans (created before this column existed) will just show blank;
-- backfill them below if you want.
-- =====================================================================

alter table delivery_challans
  add column if not exists prepared_by_name text;

-- Optional one-time backfill for existing rows, using each row's
-- created_by -> profiles.full_name (safe to run once as the project
-- owner in the SQL editor, which bypasses RLS).
update delivery_challans dc
set prepared_by_name = p.full_name
from profiles p
where dc.created_by = p.id
  and dc.prepared_by_name is null;
