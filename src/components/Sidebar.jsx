import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, FilePlus2, ListOrdered, Package, Users, Settings as SettingsIcon,
  DatabaseBackup, LogOut, ChevronLeft, ChevronRight, Truck, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../lib/permissions'

// `perm` decides who sees the menu item (see src/lib/permissions.js)
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, perm: 'dashboard.view' },
  { to: '/challan/new', label: 'Create Delivery Challan & E-Way Bill', icon: FilePlus2, perm: 'challan.create' },
  { to: '/master-list', label: 'Master List', icon: ListOrdered, perm: 'challan.view' },
  { to: '/items', label: 'Item List', icon: Package, perm: 'items.view' },
  { to: '/partners', label: 'Vendor Master', icon: Users, perm: 'partners.view' }
]

const BOTTOM_ITEMS = [
  { to: '/users', label: 'User Management', icon: ShieldCheck, perm: 'users.manage' },
  { to: '/settings', label: 'Settings', icon: SettingsIcon, perm: 'settings.view' },
  { to: '/backup-restore', label: 'Backup / Restore', icon: DatabaseBackup, perm: 'backup.use' }
]

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-gold text-navy-900' : 'text-cream-200/90 hover:bg-navy-600'
  }`

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { signOut, user, role, can } = useAuth()

  const renderItem = ({ to, label, icon: Icon, end }) => (
    <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={linkClass}>
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )

  return (
    <aside
      className={`bg-navy text-cream-200 flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? 'w-[68px]' : 'w-64'
      } h-screen sticky top-0`}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-navy-600/60">
        <div className="w-8 h-8 rounded-md bg-gold flex items-center justify-center text-navy-900 shrink-0">
          <Truck size={18} />
        </div>
        {!collapsed && (
          <div className="leading-tight overflow-hidden">
            <p className="font-display font-bold text-sm text-cream-100 whitespace-nowrap">DC &amp; E-Way Bill</p>
            <p className="text-[11px] text-navy-200 whitespace-nowrap">
              {role ? ROLE_LABELS[role] : 'Dashboard'}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_ITEMS.filter((i) => can(i.perm)).map(renderItem)}
      </nav>

      <div className="px-2 pb-3 space-y-1 border-t border-navy-600/60 pt-3">
        {BOTTOM_ITEMS.filter((i) => can(i.perm)).map(renderItem)}
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-cream-200/90 hover:bg-brick-600 hover:text-cream-100"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span className="truncate">Logout{user?.email ? ` (${user.email})` : ''}</span>}
        </button>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs text-navy-300 hover:bg-navy-600 hover:text-cream-100 mt-1"
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> Collapse</>}
        </button>
      </div>
    </aside>
  )
}
