import React, { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2 } from 'lucide-react'
import AuditHistory from './AuditHistory'
import { ACCOUNT_TYPES, flattenGroups, descendantGroupIds, validateGroup, normalizeCode } from '../../lib/ledger'
import { createGroup, updateGroup } from '../../services/ledgerService'
import { useToast } from '../../context/ToastContext'

const EMPTY = { code: '', name: '', parent_id: '', account_type: 'Asset', sort_order: 0, active: true, remarks: '' }

function Field({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-brick">{error}</p>}
    </div>
  )
}

// Create / edit an account group (admin only).
export default function GroupFormModal({ open, group, defaultParentId = '', groups, canAudit, onClose, onSaved }) {
  const toast = useToast()
  const editing = Boolean(group?.id)
  const isSystem = Boolean(group?.is_system)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('details')

  useEffect(() => {
    if (!open) return
    setTab('details')
    setErrors({})
    if (group) {
      setForm({ ...EMPTY, ...group, parent_id: group.parent_id || '', remarks: group.remarks || '' })
    } else {
      const parent = groups.find((g) => g.id === defaultParentId)
      setForm({ ...EMPTY, parent_id: defaultParentId || '', account_type: parent?.account_type || 'Asset' })
    }
  }, [open, group, defaultParentId, groups])

  // A group cannot be placed under itself or under one of its own sub-groups.
  const parentOptions = useMemo(() => {
    const blocked = editing ? descendantGroupIds(groups, group.id) : new Set()
    return flattenGroups(groups).filter((g) => !blocked.has(g.id) && (g.active || g.id === form.parent_id))
  }, [groups, editing, group, form.parent_id])

  if (!open) return null

  const parent = groups.find((g) => g.id === form.parent_id)
  const type = parent ? parent.account_type : form.account_type
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const found = validateGroup(form, { parent })
    setErrors(found)
    if (Object.keys(found).length) return
    const code = normalizeCode(form.code)
    if (groups.some((g) => g.id !== group?.id && normalizeCode(g.code) === code)) {
      setErrors({ code: 'This group code is already in use.' })
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, account_type: type }
      if (editing) await updateGroup(group.id, payload, { isSystem })
      else await createGroup(payload)
      toast.success(editing ? 'Group updated' : 'Group created')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
      <div className="card bg-white flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden !p-0">
        <div className="flex items-center justify-between bg-navy px-5 py-3">
          <h3 className="text-sm font-semibold text-white">{editing ? 'Edit account group' : 'New account group'}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        {editing && canAudit && (
          <div className="flex gap-1 border-b border-navy-100 px-4 pt-2">
            {[['details', 'Details'], ['history', 'History']].map(([k, t]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === k ? 'border-gold text-navy' : 'border-transparent text-navy-400 hover:text-navy'}`}
              >{t}</button>
            ))}
          </div>
        )}

        {tab === 'history' ? (
          <div className="flex-1 overflow-y-auto"><AuditHistory table="account_groups" recordId={group.id} /></div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {isSystem && (
                <p className="rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-600">
                  This is a standard group. Its code, type and position are fixed; you can rename it or change its order and status.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Group code *" error={errors.code}>
                  <input className="input" value={form.code} onChange={set('code')} disabled={isSystem} placeholder="e.g. AST-FA2" />
                </Field>
                <Field label="Group name *" error={errors.name}>
                  <input className="input" value={form.name} onChange={set('name')} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Parent group" error={errors.parent_id}>
                  <select className="input" value={form.parent_id} onChange={set('parent_id')} disabled={isSystem}>
                    <option value="">None (top-level group)</option>
                    {parentOptions.map((g) => (
                      <option key={g.id} value={g.id}>{'\u00A0\u00A0'.repeat(g.depth)}{g.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account type" error={errors.account_type}>
                  <select className="input" value={type} onChange={set('account_type')} disabled={isSystem || Boolean(parent)}>
                    {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  {parent && <p className="mt-1 text-xs text-navy-400">Taken from the parent group.</p>}
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Display order">
                  <input type="number" className="input" value={form.sort_order} onChange={set('sort_order')} />
                </Field>
                <label className="flex items-center gap-2 pt-6 text-sm text-navy-700">
                  <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
                </label>
              </div>
              <Field label="Remarks">
                <textarea className="input" rows={2} value={form.remarks} onChange={set('remarks')} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save group
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
