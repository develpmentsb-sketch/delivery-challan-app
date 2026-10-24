import React, { useCallback, useEffect, useState } from 'react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ROLES, ROLE_LABELS, PERMISSIONS } from '../lib/permissions'

const PERMISSION_ROWS = [
  ['View dashboard, challans, items, partners; print / export', 'challan.view'],
  ['Create & edit challans, items, partners', 'challan.create'],
  ['Delete challans, items, partners', 'challan.delete'],
  ['Change own password', 'account.change_password'],
  ['Manage users, Backup / Restore', 'users.manage']
]

export default function Users() {
  const toast = useToast()
  const { user, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [pickRole, setPickRole] = useState({}) // role chosen for each pending user before approving

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) toast.error(error.message || 'Failed to load users')
    else setRows(data || [])
    setLoading(false)
  }, [toast])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function update(row, patch) {
    setSavingId(row.id)
    const { error } = await supabase.from('profiles').update(patch).eq('id', row.id)
    setSavingId(null)
    if (error) return toast.error(error.message || 'Update failed')
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...patch } : r)))
    toast.success(`${row.email} updated`)
  }

  // Managers (and admins) approve a pending sign-up here; the database allows only this one action.
  async function approve(row) {
    const newRole = pickRole[row.id] || 'user'
    setSavingId(row.id)
    const { error } = await supabase.rpc('approve_user', { target_id: row.id, new_role: newRole })
    setSavingId(null)
    if (error) return toast.error(error.message || 'Approval failed')
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_active: true, role: newRole } : r)))
    toast.success(`${row.email} approved as ${ROLE_LABELS[newRole]}`)
  }

  async function remove(row) {
    if (!window.confirm(`Delete ${row.email}? This permanently removes their login and cannot be undone.`)) return
    setSavingId(row.id)
    const { error } = await supabase.rpc('admin_delete_user', { target_id: row.id })
    setSavingId(null)
    if (error) return toast.error(error.message || 'Delete failed')
    setRows((rs) => rs.filter((r) => r.id !== row.id))
    toast.success(`${row.email} deleted`)
  }

  return (
    <div>
      <Header
        title="User Management"
        subtitle={isAdmin ? 'Approve sign-ups, assign roles, deactivate accounts' : 'Approve new sign-ups'}
      />

      {/* Pending sign-ups: admins and managers can approve them */}
      {!loading && rows.some((r) => !r.is_active && r.role !== 'admin') && (
        <div className="card mb-6 p-5">
          <h3 className="font-semibold text-navy mb-3 text-sm">
            Waiting for approval ({rows.filter((r) => !r.is_active && r.role !== 'admin').length})
          </h3>
          <div className="space-y-2">
            {rows.filter((r) => !r.is_active && r.role !== 'admin').map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">{r.email}</p>
                  <p className="text-xs text-navy-400">Registered {new Date(r.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <select
                  className="input w-36 py-1"
                  value={pickRole[r.id] || 'user'}
                  onChange={(e) => setPickRole((p) => ({ ...p, [r.id]: e.target.value }))}
                  disabled={savingId === r.id}
                >
                  <option value="user">{ROLE_LABELS.user}</option>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                </select>
                <button type="button" className="btn-primary py-1.5" disabled={savingId === r.id} onClick={() => approve(r)}>
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th>{isAdmin && <th>Manager</th>}<th>Joined</th>{isAdmin && <th>Delete</th>}</tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isSelf = r.id === user?.id
                  return (
                    <tr key={r.id}>
                      <td className="font-medium text-navy">{r.email}{isSelf && <span className="text-xs text-navy-400"> (you)</span>}</td>
                      <td>{r.full_name || '-'}</td>
                      <td>
                        <select
                          className="input py-1"
                          value={r.role}
                          disabled={!isAdmin || isSelf || savingId === r.id}
                          onChange={(e) => update(r, { role: e.target.value })}
                        >
                          {Object.values(ROLES).map((ro) => <option key={ro} value={ro}>{ROLE_LABELS[ro]}</option>)}
                        </select>
                      </td>
                      <td>
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={r.is_active}
                            disabled={!isAdmin || isSelf || savingId === r.id}
                            onChange={(e) => update(r, { is_active: e.target.checked })}
                          />
                          {r.is_active ? 'Active' : 'Pending / Disabled'}
                        </label>
                      </td>
                      {isAdmin && (
                        <td>
                          {r.role === 'admin' ? (
                            <span className="text-xs text-navy-400">-</span>
                          ) : (
                            <label className="inline-flex items-center gap-2 text-sm" title="A manager can approve new sign-ups">
                              <input
                                type="checkbox"
                                checked={Boolean(r.can_approve)}
                                disabled={savingId === r.id}
                                onChange={(e) => update(r, { can_approve: e.target.checked })}
                              />
                              {r.can_approve ? 'Can approve' : '-'}
                            </label>
                          )}
                        </td>
                      )}
                      <td className="text-xs">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                      {isAdmin && (
                        <td>
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                            disabled={isSelf || savingId === r.id}
                            onClick={() => remove(r)}
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAdmin && (
      <div className="card p-5">
        <h3 className="font-semibold text-navy mb-3 text-sm">Role permissions</h3>
        <table className="table-base">
          <thead>
            <tr><th>Capability</th>{Object.values(ROLES).map((ro) => <th key={ro} className="text-center">{ROLE_LABELS[ro]}</th>)}</tr>
          </thead>
          <tbody>
            {PERMISSION_ROWS.map(([label, perm]) => (
              <tr key={perm}>
                <td>{label}</td>
                {Object.values(ROLES).map((ro) => (
                  <td key={ro} className="text-center">{PERMISSIONS[perm].includes(ro) ? '\u2713' : '\u2014'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}
