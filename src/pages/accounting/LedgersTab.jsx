import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, RefreshCw, Search, FolderPlus, Loader2, Save, X, ChevronRight, ChevronDown, Power, List, ListTree } from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { saveLedger, deleteLedger, createGroup, syncPartnerLedgers, setLedgerActive } from '../../services/accountingService'
import { indexGroups, ledgerInfos, inr } from '../../utils/accounting'

const emptyLedger = () => ({ code: '', name: '', group_id: '', opening_balance: '', opening_type: 'Dr', active: true, remarks: '', gst_applicable: false, gst_category: '', cost_centre_applicable: false, bank_name: '', bank_account_no: '', ifsc: '' })
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

export default function LedgersTab({ company, groups, ledgers, canWrite, canDelete, reload, command, onCommandDone }) {
  const toast = useToast()
  const gi = useMemo(() => indexGroups(groups), [groups])
  const infos = useMemo(() => ledgerInfos(ledgers, gi), [ledgers, gi])
  const [q, setQ] = useState('')
  const [modal, setModal] = useState(null)
  const [grpModal, setGrpModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [view, setView] = useState('list') // list | tree
  const [showInactive, setShowInactive] = useState(true)
  const [open, setOpen] = useState({}) // tree: group id -> expanded

  const groupOptions = useMemo(
    () => groups.map((g) => ({ id: g.id, label: gi.path(g.id).join(' > ') })).sort((a, b) => a.label.localeCompare(b.label)),
    [groups, gi]
  )
  const rows = infos.filter((l) => (showInactive || l.active !== false) && (!q || l.name.toLowerCase().includes(q.toLowerCase()) || l.groupName.toLowerCase().includes(q.toLowerCase()) || (l.code || '').toLowerCase().includes(q.toLowerCase())))
  // next free code: L0001, L0002 ...
  const nextCode = () => `L${String(ledgers.reduce((m, l) => Math.max(m, Number((/^L(\d+)$/i.exec(l.code || '') || [0, 0])[1])), 0) + 1).padStart(4, '0')}`
  const newLedger = (extra = {}) => setModal({ ...emptyLedger(), code: nextCode(), ...extra })
  const childGroups = useMemo(() => {
    const m = {}
    groups.forEach((g) => { (m[g.parent_id || 'root'] = m[g.parent_id || 'root'] || []).push(g) })
    Object.values(m).forEach((a) => a.sort((x, y) => x.name.localeCompare(y.name)))
    return m
  }, [groups])
  const ledgersOfGroup = useMemo(() => {
    const m = {}
    rows.forEach((l) => { (m[l.group_id] = m[l.group_id] || []).push(l) })
    Object.values(m).forEach((a) => a.sort((x, y) => x.name.localeCompare(y.name)))
    return m
  }, [rows])
  const countIn = (gid) => (ledgersOfGroup[gid] || []).length + (childGroups[gid] || []).reduce((s, g) => s + countIn(g.id), 0)
  const openDr = infos.reduce((s, l) => s + (l.openSigned > 0 ? l.openSigned : 0), 0)
  const openCr = infos.reduce((s, l) => s + (l.openSigned < 0 ? -l.openSigned : 0), 0)

  const modalGroup = modal ? gi.byId[modal.group_id] : null
  const modalNominal = modalGroup && (modalGroup.nature === 'Income' || modalGroup.nature === 'Expense')

  async function save() {
    if (!modal.name.trim()) return toast.error('Enter the ledger name')
    if (!modal.group_id) return toast.error('Choose the group')
    if (!modal.code?.trim()) return toast.error('Enter the ledger code')
    if (ledgers.some((l) => l.id !== modal.id && (l.code || '').toLowerCase() === modal.code.trim().toLowerCase())) return toast.error('This ledger code is already used')
    if (modal.ifsc && !IFSC_RE.test(modal.ifsc.trim().toUpperCase())) return toast.error('The IFSC code looks wrong (example SBIN0001234)')
    if (modal.bank_account_no && !/^\d{9,18}$/.test(modal.bank_account_no.trim())) return toast.error('The bank account number should be 9 to 18 digits')
    setSaving(true)
    try {
      await saveLedger(company, { ...modal, opening_balance: modalNominal ? 0 : modal.opening_balance })
      toast.success('Ledger saved')
      setModal(null)
      reload()
    } catch (e) {
      toast.error(e.message?.includes('acc_ledgers_code') ? 'This ledger code is already used' : e.message?.includes('duplicate') ? 'A ledger with this name already exists' : e.message || 'Could not save')
    } finally { setSaving(false) }
  }

  async function toggleActive(l) {
    try { await setLedgerActive(l.id, l.active === false); toast.success(l.active === false ? 'Ledger activated' : 'Ledger deactivated - it no longer appears in vouchers or invoices'); reload() }
    catch (e) { toast.error(e.message || 'Could not change the status') }
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

  // Menu commands (Edit > New Ledger, Data > Sync customers and vendors)
  useEffect(() => {
    if (!command) return
    if (command.name === 'newLedger' && canWrite) {
      const bank = command.arg === 'bank' ? groups.find((g) => /^bank accounts?$/i.test(g.name)) : null
      newLedger(bank ? { group_id: bank.id } : {})
    }
    if (command.name === 'sync' && canWrite) sync()
    onCommandDone?.()
  }, [command]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remove() {
    try { await deleteLedger(toDelete.id); toast.success('Ledger deleted'); setToDelete(null); reload() }
    catch (e) { toast.error(`${e.message} You can deactivate it instead.`); setToDelete(null) }
  }

  const actions = (l) => canWrite && (
    <div className="flex gap-2">
      <button className="text-navy-400 hover:text-navy" title="Edit" onClick={() => setModal({ ...l, code: l.code || nextCode(), opening_balance: l.opening_balance || '' })}><Pencil size={14} /></button>
      <button className={l.active === false ? 'text-forest-600' : 'text-navy-400 hover:text-gold-700'} title={l.active === false ? 'Activate' : 'Deactivate'} onClick={() => toggleActive(l)}><Power size={14} /></button>
      {canDelete && <button className="text-navy-400 hover:text-brick" title="Delete" onClick={() => setToDelete(l)}><Trash2 size={14} /></button>}
    </div>
  )

  // Chart of Accounts tree: groups inside groups, ledgers at the bottom
  const TreeGroup = ({ g, depth }) => {
    const isOpen = open[g.id] ?? depth === 0
    const kids = childGroups[g.id] || []
    const leaves = ledgersOfGroup[g.id] || []
    return (
      <div>
        <button type="button" className="flex w-full items-center gap-1 rounded px-2 py-1.5 text-left hover:bg-navy-50" style={{ paddingLeft: 8 + depth * 18 }} onClick={() => setOpen((o) => ({ ...o, [g.id]: !isOpen }))}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="text-sm font-semibold text-navy">{g.name}</span>
          <span className="text-[11px] text-navy-400">({countIn(g.id)})</span>
          {g.is_system && <span className="ml-1 text-[10px] uppercase text-navy-300">system group</span>}
        </button>
        {isOpen && (
          <div>
            {kids.map((k) => <TreeGroup key={k.id} g={k} depth={depth + 1} />)}
            {leaves.map((l) => (
              <div key={l.id} className={`flex items-center gap-3 rounded px-2 py-1 hover:bg-cream-100 ${l.active === false ? 'opacity-60' : ''}`} style={{ paddingLeft: 30 + (depth + 1) * 18 }}>
                <span className="w-16 text-[11px] font-semibold text-navy-400">{l.code || ''}</span>
                <span className="flex-1 text-sm text-navy">{l.name}{l.active === false && <span className="ml-2 text-[11px] text-brick">inactive</span>}</span>
                <span className="text-xs tabular-nums text-navy-500">{l.nominal || !Number(l.opening_balance) ? '' : `${inr(l.opening_balance)} ${l.opening_type}`}</span>
                {actions(l)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-3 text-navy-300" />
          <input className="input pl-8" placeholder="Search ledger or group..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex overflow-hidden rounded-lg border border-navy-100">
          <button className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold ${view === 'list' ? 'bg-navy text-white' : 'text-navy-500'}`} onClick={() => setView('list')}><List size={14} /> List</button>
          <button className={`flex items-center gap-1 px-3 py-2 text-xs font-semibold ${view === 'tree' ? 'bg-navy text-white' : 'text-navy-500'}`} onClick={() => setView('tree')}><ListTree size={14} /> Chart of Accounts</button>
        </div>
        <label className="flex items-center gap-2 text-xs text-navy-500"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
        {canWrite && (
          <>
            <button className="btn-gold" onClick={() => newLedger()}><Plus size={16} /> New Ledger</button>
            <button className="btn-outline" onClick={() => setGrpModal({ name: '', parent_id: '' })}><FolderPlus size={16} /> New Group</button>
            <button className="btn-outline" disabled={syncing} onClick={sync} title="Creates a ledger for each vendor (Sundry Creditors) and customer (Sundry Debtors)">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sync Vendors &amp; Customers
            </button>
          </>
        )}
      </div>

      {view === 'tree' && (
        <div className="card p-3">
          {(childGroups.root || []).map((g) => <TreeGroup key={g.id} g={g} depth={0} />)}
          {!groups.length && <p className="py-6 text-center text-sm text-navy-400">No groups yet.</p>}
        </div>
      )}

      {view === 'list' && (
      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead><tr><th>Code</th><th>Ledger</th><th>Group</th><th className="text-right">Opening balance</th><th>Linked to</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id} className={l.active === false ? 'opacity-60' : ''}>
                <td className="text-xs font-semibold text-navy-500">{l.code || '-'}</td>
                <td className="font-medium text-navy">{l.name}</td>
                <td className="text-xs">{gi.path(l.group_id).join(' > ')}</td>
                <td className="text-right text-xs tabular-nums">{l.nominal || !Number(l.opening_balance) ? '-' : `${inr(l.opening_balance)} ${l.opening_type}`}</td>
                <td className="text-xs">{l.partner_id ? <span className="badge bg-forest-100 text-forest-600">Vendor / Customer</span> : '-'}</td>
                <td><span className={`badge ${l.active === false ? 'bg-brick/10 text-brick' : 'bg-forest-100 text-forest-600'}`}>{l.active === false ? 'Inactive' : 'Active'}</span></td>
                <td>{actions(l)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-sm text-navy-400">No ledgers yet. Add one, or use "Sync Vendors &amp; Customers".</td></tr>}
          </tbody>
        </table>
        <div className="border-t border-navy-100 px-4 py-2 text-xs text-navy-500">
          Opening balances in total: Dr {inr(openDr)} | Cr {inr(openCr)}
          {Math.abs(openDr - openCr) > 0.005 && <span className="ml-2 font-semibold text-brick">They must be equal for the Balance Sheet to tally (difference {inr(Math.abs(openDr - openCr))}).</span>}
        </div>
      </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card w-full max-w-lg bg-white !p-0 overflow-hidden">
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold text-white">{modal.id ? 'Edit Ledger' : 'New Ledger'}</h3>
              <button onClick={() => setModal(null)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="label">Ledger code *</label><input className="input" value={modal.code || ''} onChange={(e) => setModal({ ...modal, code: e.target.value.toUpperCase() })} /></div>
                <div className="col-span-2"><label className="label">Ledger name *</label><input className="input" value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} /></div>
              </div>
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
              {modalGroup && <p className="text-xs text-navy-400">Account type: <b>{modalGroup.nature}</b>. Opening balance is as on the books start date.</p>}
              {modalGroup && /bank/i.test(gi.path(modalGroup.id).join(' ')) && (
                <div className="grid grid-cols-3 gap-3 rounded-lg border border-navy-100 p-3">
                  <div><label className="label">Bank name</label><input className="input" value={modal.bank_name || ''} onChange={(e) => setModal({ ...modal, bank_name: e.target.value })} /></div>
                  <div><label className="label">Account no.</label><input className="input" value={modal.bank_account_no || ''} onChange={(e) => setModal({ ...modal, bank_account_no: e.target.value })} /></div>
                  <div><label className="label">IFSC</label><input className="input" maxLength={11} value={modal.ifsc || ''} onChange={(e) => setModal({ ...modal, ifsc: e.target.value.toUpperCase() })} /></div>
                </div>
              )}
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-navy-600">
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(modal.gst_applicable)} onChange={(e) => setModal({ ...modal, gst_applicable: e.target.checked })} /> GST applicable</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(modal.cost_centre_applicable)} onChange={(e) => setModal({ ...modal, cost_centre_applicable: e.target.checked })} /> Cost centre applicable</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={modal.active !== false} onChange={(e) => setModal({ ...modal, active: e.target.checked })} /> Active</label>
              </div>
              {modal.gst_applicable && <div><label className="label">GST tax category</label><input className="input" placeholder="e.g. Output GST 18%" value={modal.gst_category || ''} onChange={(e) => setModal({ ...modal, gst_category: e.target.value })} /></div>}
              <div><label className="label">Remarks</label><input className="input" value={modal.remarks || ''} onChange={(e) => setModal({ ...modal, remarks: e.target.value })} /></div>
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
