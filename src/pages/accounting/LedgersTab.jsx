import React, { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, Search, FolderPlus, Loader2, Save, X } from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { saveLedger, deleteLedger, createGroup, syncPartnerLedgers } from '../../services/accountingService'
import { indexGroups, ledgerInfos, inr } from '../../utils/accounting'

const emptyLedger = () => ({ name: '', group_id: '', opening_balance: '', opening_type: 'Dr', active: true })

export default function LedgersTab({ company, groups, ledgers, canWrite, canDelete, reload }) {
  const toast = useToast()
  const gi = useMemo(() => indexGroups(groups), [groups])
  const infos = useMemo(() => ledgerInfos(ledgers, gi), [ledgers, gi])
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [grpModal, setGrpModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const groupOptions = useMemo(
    () => groups.map((g) => ({ id: g.id, label: gi.path(g.id).join(' > ') })).sort((a, b) => a.label.localeCompare(b.label)),
    [groups, gi]
  )
  const rows = infos.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.groupName.toLowerCase().includes(q.toLowerCase()))
  const openDr = infos.reduce((s, l) => s + (l.openSigned > 0 ? l.openSigned : 0), 0)
  const openCr = infos.reduce((s, l) => s + (l.openSigned < 0 ? -l.openSigned : 0), 0)

  const modalGroup = modal ? gi.byId[modal.group_id] : null
  const modalNominal = modalGroup && (modalGroup.nature === 'Income' || modalGroup.nature === 'Expense')

  async function save() {
    if (!modal.name.trim()) return toast.error('Enter the ledger name')
    if (!modal.group_id) return toast.error('Choose the group')
    setSaving(true)
    try {
      await saveLedger(company, { ...modal, opening_balance: modalNominal ? 0 : modal.opening_balance })
      toast.success('Ledger saved')
      setModal(null)
      reload()
    } catch (e) {
      toast.error(e.message?.includes('duplicate') ? 'A ledger with this name already exists' : e.message || 'Could not save')
    } finally { setSaving(false) }
  }

  async function saveGroup() {
    if (!grpModal.name.trim() || !grpModal.parent_id) return toast.error('Enter the group name and choose where it sits')
    setSaving(true)
    try {
      const parent = gi.byId[grpModal.parent_id]
      await createGroup(company, { name: grpModal.name.trim(), parent_id: parent.id, nature: parent.nature })
      toast.success('Group added')
      setGrpModal(null)
      reload()
    } catch (e) {
      toast.error(e.message?.includes('duplicate') ? 'A group with this name already exists' : e.message || 'Could not save')
    } finally { setSaving(false) }
  }

  async function sync() {
    setSyncing(true)
    try {
      const r = await syncPartnerLedgers(company, groups, ledgers)
      toast.success(`${r.created} new ledger(s) created from Vendor / Customer Master${r.linked ? `, ${r.linked} linked` : ''}`)
      reload()
    } catch (e) { toast.error(e.message || 'Could not sync') } finally { setSyncing(false) }
  }

  async function remove() {
    try { await deleteLedger(toDelete.id); toast.success('Ledger deleted'); setToDelete(null); reload() }
    catch (e) { toast.error(e.message); setToDelete(null) }
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-3 text-navy-300" />
          <input className="input pl-8" placeholder="Search ledger or group..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {canWrite && (
          <>
            <button className="btn-gold" onClick={() => setModal(emptyLedger())}><Plus size={16} /> New Ledger</button>
            <button className="btn-outline" onClick={() => setGrpModal({ name: '', parent_id: '' })}><FolderPlus size={16} /> New Group</button>
            <button className="btn-outline" disabled={syncing} onClick={sync} title="Creates a ledger for each vendor (Sundry Creditors) and customer (Sundry Debtors)">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sync Vendors &amp; Customers
            </button>
          </>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Ledger</th><th>Group</th><th className="text-right">Opening balance</th><th>Linked to</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="font-medium text-navy">{l.name}</td>
                <td className="text-xs">{gi.path(l.group_id).join(' > ')}</td>
                <td className="text-right text-xs tabular-nums">{l.nominal || !Number(l.opening_balance) ? '-' : `${inr(l.opening_balance)} ${l.opening_type}`}</td>
                <td className="text-xs">{l.partner_id ? <span className="badge bg-forest-100 text-forest-600">Vendor / Customer</span> : '-'}</td>
                <td>
                  {canWrite && (
                    <div className="flex gap-2">
                      <button className="text-navy-400 hover:text-navy" onClick={() => setModal({ ...l, opening_balance: l.opening_balance || '' })}><Pencil size={14} /></button>
                      {canDelete && <button className="text-navy-400 hover:text-brick" onClick={() => setToDelete(l)}><Trash2 size={14} /></button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-navy-400">No ledgers yet. Add one, or use "Sync Vendors &amp; Customers".</td></tr>}
          </tbody>
        </table>
        <div className="border-t border-navy-100 px-4 py-2 text-xs text-navy-500">
          Opening balances in total: Dr {inr(openDr)} | Cr {inr(openCr)}
          {Math.abs(openDr - openCr) > 0.005 && <span className="ml-2 font-semibold text-brick">They must be equal for the Balance Sheet to tally (difference {inr(Math.abs(openDr - openCr))}).</span>}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card w-full max-w-lg bg-white !p-0 overflow-hidden">
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold text-white">{modal.id ? 'Edit Ledger' : 'New Ledger'}</h3>
              <button onClick={() => setModal(null)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div><label className="label">Ledger name *</label><input className="input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
              <div>
                <label className="label">Under group *</label>
                <select className="input" value={modal.group_id} onChange={(e) => setModal({ ...modal, group_id: e.target.value })}>
                  <option value="">Select group</option>
                  {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
              {modalGroup && !modalNominal && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Opening balance (Rs)</label><input type="number" min="0" step="0.01" className="input" value={modal.opening_balance} onChange={(e) => setModal({ ...modal, opening_balance: e.target.value })} /></div>
                  <div><label className="label">Dr / Cr</label>
                    <select className="input" value={modal.opening_type} onChange={(e) => setModal({ ...modal, opening_type: e.target.value })}><option>Dr</option><option>Cr</option></select>
                  </div>
                </div>
              )}
              {modalNominal && <p className="text-xs text-navy-400">Income and expense ledgers start at zero each year, so there is no opening balance.</p>}
              {modalGroup?.sched3 === 'inventories' || (modalGroup && gi.sched(modalGroup.id) === 'inventories') ? (
                <p className="text-xs text-gold-700">Stock-in-Hand ledgers hold only the opening stock. Closing stock is entered each year on the Trading &amp; P&amp;L report.</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button className="btn-outline" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
            </div>
          </div>
        </div>
      )}

      {grpModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card w-full max-w-md bg-white !p-0 overflow-hidden">
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold text-white">New Group</h3>
              <button onClick={() => setGrpModal(null)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div><label className="label">Group name *</label><input className="input" value={grpModal.name} onChange={(e) => setGrpModal({ ...grpModal, name: e.target.value })} /></div>
              <div>
                <label className="label">Under *</label>
                <select className="input" value={grpModal.parent_id} onChange={(e) => setGrpModal({ ...grpModal, parent_id: e.target.value })}>
                  <option value="">Select parent group</option>
                  {groupOptions.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button className="btn-outline" onClick={() => setGrpModal(null)}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={saveGroup}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this ledger?" message={`"${toDelete?.name}" will be removed. A ledger that already has vouchers cannot be deleted.`}
        confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  )
}
