import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X, Save, Loader2, Eye } from 'lucide-react'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToast } from '../../context/ToastContext'
import { listVouchers, saveVoucher, deleteVoucher } from '../../services/accountingService'
import { indexGroups, ledgerInfos, fyRange, inr } from '../../utils/accounting'

const TYPES = ['Payment', 'Receipt', 'Journal', 'Contra']
const HELP = {
  Payment: 'Money going out. Pick the cash / bank account it is paid from, then the ledgers that are debited.',
  Receipt: 'Money coming in. Pick the cash / bank account it is received in, then the ledgers that are credited.',
  Contra: 'Cash to bank or bank to bank. Pick the account money leaves, then the account it goes to.',
  Journal: 'Any other entry. Add debit and credit lines; the totals must be equal.'
}
const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const dmy = (s) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '')
const blankLine = (side) => ({ name: '', side, amount: '' })

export default function VouchersTab({ company, fy, groups, ledgers, canWrite, canDelete }) {
  const toast = useToast()
  const gi = useMemo(() => indexGroups(groups), [groups])
  const infos = useMemo(() => ledgerInfos(ledgers.filter((l) => l.active !== false), gi), [ledgers, gi])
  const idByName = useMemo(() => Object.fromEntries(ledgers.map((l) => [l.name.trim().toLowerCase(), l.id])), [ledgers])
  const nameById = useMemo(() => Object.fromEntries(ledgers.map((l) => [l.id, l.name])), [ledgers])
  const cashNames = useMemo(() => infos.filter((l) => l.sched === 'cash_bank').map((l) => l.name), [infos])

  const range = fyRange(fy)
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  async function load() {
    setLoading(true)
    try { setVouchers(await listVouchers(company, range.from, range.to)) }
    catch (e) { toast.error(e.message || 'Could not load vouchers') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [company, fy]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = vouchers.filter((v) => {
    if (typeFilter && v.voucher_type !== typeFilter) return false
    if (!q) return true
    const t = `${v.voucher_no} ${v.narration || ''} ${(v.acc_entries || []).map((e) => nameById[e.ledger_id]).join(' ')}`.toLowerCase()
    return t.includes(q.toLowerCase())
  })

  function openNew(type) {
    const date = todayStr()
    setForm({ id: null, type, date: date >= range.from && date <= range.to ? date : range.to, narration: '', header: '', free: type === 'Journal',
      lines: type === 'Journal' ? [blankLine('Dr'), blankLine('Cr')] : [blankLine(type === 'Receipt' ? 'Cr' : 'Dr')] })
  }

  function openExisting(v) {
    const es = [...(v.acc_entries || [])].sort((a, b) => a.line_no - b.line_no)
    const toLine = (e) => ({ name: nameById[e.ledger_id] || '', side: Number(e.debit) > 0 ? 'Dr' : 'Cr', amount: String(Number(e.debit) || Number(e.credit)) })
    const headerSide = v.voucher_type === 'Receipt' ? 'Dr' : 'Cr'
    const headers = es.filter((e) => (headerSide === 'Dr' ? Number(e.debit) > 0 : Number(e.credit) > 0))
    const simple = v.voucher_type !== 'Journal' && headers.length === 1
    setForm({
      id: v.id, type: v.voucher_type, date: v.voucher_date, narration: v.narration || '', free: !simple,
      header: simple ? nameById[headers[0].ledger_id] || '' : '',
      lines: (simple ? es.filter((e) => e !== headers[0]) : es).map(toLine)
    })
  }

  const lineTotal = (side) => form ? form.lines.filter((l) => (form.free ? l.side === side : true)).reduce((s, l) => s + (Number(l.amount) || 0), 0) : 0
  const totals = useMemo(() => {
    if (!form) return { dr: 0, cr: 0 }
    const sum = form.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0)
    if (form.free) {
      return { dr: form.lines.filter((l) => l.side === 'Dr').reduce((s, l) => s + (Number(l.amount) || 0), 0), cr: form.lines.filter((l) => l.side === 'Cr').reduce((s, l) => s + (Number(l.amount) || 0), 0) }
    }
    return form.type === 'Receipt' ? { dr: sum, cr: sum } : { dr: sum, cr: sum }
  }, [form])

  async function save() {
    const idOf = (n) => idByName[String(n).trim().toLowerCase()]
    const entries = []
    const lines = form.lines.filter((l) => l.name || l.amount)
    for (const l of lines) {
      if (!idOf(l.name)) return toast.error(`Ledger "${l.name || '(blank)'}" was not found. Choose from the list or create it in Ledgers.`)
      if (!(Number(l.amount) > 0)) return toast.error('Enter an amount for every line')
    }
    if (form.free) {
      lines.forEach((l) => entries.push({ ledger_id: idOf(l.name), debit: l.side === 'Dr' ? Number(l.amount) : 0, credit: l.side === 'Cr' ? Number(l.amount) : 0 }))
    } else {
      if (!idOf(form.header)) return toast.error(form.type === 'Receipt' ? 'Choose the cash / bank account money is received in' : 'Choose the cash / bank account')
      const total = lines.reduce((s, l) => s + Number(l.amount), 0)
      const lineSide = form.type === 'Receipt' ? 'credit' : 'debit'
      lines.forEach((l) => entries.push({ ledger_id: idOf(l.name), debit: lineSide === 'debit' ? Number(l.amount) : 0, credit: lineSide === 'credit' ? Number(l.amount) : 0 }))
      entries.push({ ledger_id: idOf(form.header), debit: form.type === 'Receipt' ? total : 0, credit: form.type === 'Receipt' ? 0 : total })
    }
    if (entries.length < 2) return toast.error('Add at least one line')
    setSaving(true)
    try {
      await saveVoucher({ id: form.id, company, type: form.type, date: form.date, narration: form.narration, entries })
      toast.success('Voucher saved')
      setForm(null)
      load()
    } catch (e) { toast.error(e.message || 'Could not save') } finally { setSaving(false) }
  }

  async function remove() {
    try { await deleteVoucher(toDelete.id); toast.success('Voucher deleted'); setToDelete(null); load() }
    catch (e) { toast.error(e.message); setToDelete(null) }
  }

  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }))
  const unknown = (n) => n && !idByName[String(n).trim().toLowerCase()]
  const balanced = form && Math.abs(totals.dr - totals.cr) < 0.005 && totals.dr > 0
  const ro = form && !canWrite

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        {canWrite && TYPES.map((t) => <button key={t} className={t === 'Payment' ? 'btn-gold' : 'btn-outline'} onClick={() => openNew(t)}><Plus size={16} /> {t}</button>)}
        <select className="input max-w-[160px]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input className="input max-w-xs flex-1" placeholder="Search voucher no, ledger, narration..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        {loading ? <LoadingSpinner /> : (
          <table className="table-base">
            <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th className="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              {shown.map((v) => {
                const es = v.acc_entries || []
                const amt = es.reduce((s, e) => s + Number(e.debit), 0)
                return (
                  <tr key={v.id}>
                    <td className="text-xs">{dmy(v.voucher_date)}</td>
                    <td className="text-xs font-semibold text-navy-500">{v.voucher_type} {v.voucher_no}</td>
                    <td className="max-w-[360px] truncate text-xs" title={v.narration || ''}>
                      {[...new Set(es.map((e) => nameById[e.ledger_id]).filter(Boolean))].join(', ')}
                      {v.narration ? <span className="text-navy-400"> - {v.narration}</span> : null}
                    </td>
                    <td className="text-right text-xs tabular-nums">{inr(amt)}</td>
                    <td>
                      <div className="flex gap-2">
                        <button className="text-navy-400 hover:text-navy" onClick={() => openExisting(v)} title={canWrite ? 'Edit' : 'View'}><Eye size={14} /></button>
                        {canDelete && <button className="text-navy-400 hover:text-brick" onClick={() => setToDelete(v)}><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!shown.length && <tr><td colSpan={5} className="py-8 text-center text-sm text-navy-400">No vouchers in FY {fy}.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-white !p-0">
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold text-white">{form.type} Voucher <span className="font-normal text-white/60">- {form.id ? (ro ? 'View' : 'Edit') : 'New'}</span></h3>
              <button onClick={() => setForm(null)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-500">{HELP[form.type]}</p>
              <fieldset disabled={ro} className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div><label className="label">Type</label>
                    <select className="input" value={form.type} disabled={Boolean(form.id)} onChange={(e) => openNew(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select>
                  </div>
                  <div><label className="label">Date *</label><input type="date" className="input" min={range.from} max={range.to} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><label className="label">Voucher no.</label><input disabled className="input bg-navy-50" value={form.id ? 'Kept / renumbered on save' : 'Automatic'} /></div>
                </div>

                {!form.free && (
                  <div>
                    <label className="label">{form.type === 'Receipt' ? 'Received in (cash / bank) *' : form.type === 'Contra' ? 'From (cash / bank) *' : 'Paid from (cash / bank) *'}</label>
                    <input className={`input ${unknown(form.header) ? 'border-brick' : ''}`} list="acc-cash" value={form.header} onChange={(e) => setForm({ ...form, header: e.target.value })} placeholder="Type to search" />
                  </div>
                )}

                <div>
                  <label className="label">{form.free ? 'Lines' : form.type === 'Receipt' ? 'Received from (credit)' : form.type === 'Contra' ? 'To (cash / bank)' : 'Paid to / expense (debit)'}</label>
                  <div className="space-y-2">
                    {form.lines.map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {form.free && (
                          <select className="input !w-20 shrink-0" value={l.side} onChange={(e) => setLine(i, { side: e.target.value })}><option>Dr</option><option>Cr</option></select>
                        )}
                        <input className={`input flex-1 ${unknown(l.name) ? 'border-brick' : ''}`} list={form.type === 'Contra' && !form.free ? 'acc-cash' : 'acc-all'} placeholder="Ledger - type to search" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
                        <input type="number" min="0" step="0.01" className="input !w-36 shrink-0 text-right" placeholder="Amount" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                        {!ro && form.lines.length > 1 && <button type="button" className="text-brick" onClick={() => setForm({ ...form, lines: form.lines.filter((_, k) => k !== i) })}><Trash2 size={14} /></button>}
                      </div>
                    ))}
                  </div>
                  {!ro && <button type="button" className="mt-2 text-xs font-semibold text-navy-500 hover:text-navy" onClick={() => setForm({ ...form, lines: [...form.lines, blankLine(form.free ? (totals.dr > totals.cr ? 'Cr' : 'Dr') : form.lines[0]?.side || 'Dr')] })}>+ Add line</button>}
                </div>

                <div><label className="label">Narration</label><input className="input" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} /></div>
              </fieldset>

              <div className={`rounded-lg px-3 py-2 text-xs ${balanced ? 'bg-forest-100 text-forest-600' : 'bg-gold-50 text-gold-700'}`}>
                Debit {inr(totals.dr)} | Credit {inr(totals.cr)}{!balanced && form.free ? ` | Difference ${inr(Math.abs(totals.dr - totals.cr))}` : ''}
              </div>
              <datalist id="acc-all">{infos.map((l) => <option key={l.id} value={l.name} />)}</datalist>
              <datalist id="acc-cash">{cashNames.map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button className="btn-outline" onClick={() => setForm(null)}>{ro ? 'Close' : 'Cancel'}</button>
              {!ro && <button className="btn-primary" disabled={saving || !balanced} onClick={save}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this voucher?" message={`${toDelete?.voucher_type} ${toDelete?.voucher_no} and its entries will be removed permanently.`}
        confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  )
}
