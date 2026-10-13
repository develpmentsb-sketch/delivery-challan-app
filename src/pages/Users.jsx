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
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,is_active,created_at')
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
      <Header title="User Management" subtitle="Approve sign-ups, assign roles, deactivate accounts" />

      <div className="card mb-6">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Delete</th></tr>
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
                          disabled={isSelf || savingId === r.id}
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
                            disabled={isSelf || savingId === r.id}
                            onChange={(e) => update(r, { is_active: e.target.checked })}
                          />
                          {r.is_active ? 'Active' : 'Pending / Disabled'}
                        </label>
                      </td>
                      <td className="text-xs">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
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
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
    </div>
  )
}
