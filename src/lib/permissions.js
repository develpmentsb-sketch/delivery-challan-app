// Single source of truth for who can do what in the UI.
// (The database enforces the same rules via RLS – see supabase/roles_and_rls.sql.
//  Hiding a button is convenience; RLS is the real security.)

export const ROLES = {
  ADMIN: 'admin',   // everything, incl. user management, delete, backup/restore
  USER: 'user',     // create / edit / print challans, items, partners – no delete
  VIEWER: 'viewer'  // read-only + print
}

export const ROLE_LABELS = {
  admin: 'Admin',
  user: 'Operator',
  viewer: 'Viewer'
}

const ALL = ['admin', 'user', 'viewer']
const WRITERS = ['admin', 'user']
const ADMIN_ONLY = ['admin']

export const PERMISSIONS = {
  'dashboard.view': ALL,

  'challan.view': ALL,
  'challan.print': ALL,
  'challan.create': WRITERS,
  'challan.edit': WRITERS,
  'challan.delete': ADMIN_ONLY,
  'challan.export': ALL,

  'items.view': ALL,
  'items.write': WRITERS,
  'items.delete': ADMIN_ONLY,

  'partners.view': ALL,
  'partners.write': WRITERS,
  'partners.delete': ADMIN_ONLY,

  'settings.view': ALL,
  'company.edit': ADMIN_ONLY,
  'users.manage': ADMIN_ONLY,
  'backup.use': ADMIN_ONLY
}

export function can(role, permission) {
  return Boolean(role && PERMISSIONS[permission]?.includes(role))
}
