import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X, Save, Loader2, Eye, Printer, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import ConfirmDialog from '../../components/ConfirmDialog'
import LoadingSpinner from '../../components/LoadingSpinner'
import { useToast } from '../../context/ToastContext'
import { INDIAN_STATES } from '../../lib/constants'
import { listInvoices, listPartnersLite, ensureInvoiceLedgers, saveInvoice, deleteVoucher } from '../../services/accountingService'
import { indexGroups, ledgerInfos, fyRange, inr } from '../../utils/accounting'
import { GST_RATES, UOMS, blankLine, calcInvoice, amountInWords } from '../../utils/invoice'

const todayStr = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
const dmy = (s) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '')
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const stateCodeOf = (name) => INDIAN_STATES.find((s) => s.name === name)?.code

export default function InvoicesTab({ company, companyInfo, companyName, fy, groups, ledgers, canWrite, canDelete, reload }) {
  const toast = useToast()
  const range = fyRange(fy)
  const gi = useMemo(() => indexGroups(groups), [groups])
  const infos = useMemo(() => ledgerInfos(ledgers.filter((l) => l.active !== false), gi), [ledgers, gi])
  const nameById = useMemo(() => Object.fromEntries(ledgers.map((l) => [l.id, l.name])), [ledgers])
  const idByName = useMemo(() => Object.fromEntries(ledgers.map((l) => [l.name.trim().toLowerCase(), l.id])), [ledgers])

  const [kind, setKind] = useState('Sales')
  const [invoices, setInvoices] = useState([])
  const [partners, setPartners] = useState({})
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)

  const partyLedgers = useMemo(
    () => infos.filter((l) => l.sched === (kind === 'Sales' ? 'trade_receivables' : 'trade_payables')),
    [infos, kind]
  )
  const partyByName = useMemo(() => Object.fromEntries(partyLedgers.map((l) => [l.name.trim().toLowerCase(), l])), [partyLedgers])

  async function load() {
    setLoading(true)
    try {
      const [inv, ps] = await Promise.all([listInvoices(company, kind, range.from, range.to), listPartnersLite().catch(() => [])])
      setInvoices(inv)
      setPartners(Object.fromEntries(ps.map((p) => [p.id, p])))
    } catch (e) { toast.error(e.message || 'Could not load invoices') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [company, fy, kind]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = invoices.filter((i) => {
    if (!q) return true
    return `${i.invoice_no} ${nameById[i.party_ledger_id] || ''} ${i.party_gstin || ''} ${i.reference || ''}`.toLowerCase().includes(q.toLowerCase())
  })
  const sums = shown.reduce((a, i) => ({ taxable: a.taxable + Number(i.taxable), cgst: a.cgst + Number(i.cgst), sgst: a.sgst + Number(i.sgst), igst: a.igst + Number(i.igst), total: a.total + Number(i.total) }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 })

  const myStateCode = companyInfo?.gstin ? String(companyInfo.gstin).slice(0, 2) : companyInfo?.state_code ? String(companyInfo.state_code).padStart(2, '0') : ''

  function suggestSupply(posName, gstin, current) {
    const code = (gstin && gstin.length >= 2 ? gstin.slice(0, 2) : '') || stateCodeOf(posName)
    if (!code || !myStateCode) return current
    return String(code).padStart(2, '0') === myStateCode ? 'Intra' : 'Inter'
  }

  function openNew() {
    const date = todayStr()
    setForm({ id: null, date: date >= range.from && date <= range.to ? date : range.to, invoiceNo: '', party: '', gstin: '', pos: '', supply: 'Intra',
      due: '', reference: '', narration: '', round: true, lines: [blankLine()] })
  }
  function openExisting(inv) {
    const lines = [...(inv.acc_invoice_lines || [])].sort((a, b) => a.line_no - b.line_no).map((l) => ({
      description: l.description, hsn: l.hsn || '', qty: String(Number(l.qty)), uom: l.uom || '', rate: String(Number(l.rate)),
      discount_pct: String(Number(l.discount_pct)), gst_rate: String(Number(l.gst_rate))
    }))
    setForm({ id: inv.id, date: inv.invoice_date, invoiceNo: inv.invoice_no, party: nameById[inv.party_ledger_id] || '', gstin: inv.party_gstin || '',
      pos: inv.place_of_supply || '', supply: inv.supply_type, due: inv.due_date || '', reference: inv.reference || '', narration: inv.narration || '',
      round: Math.abs(Number(inv.round_off)) > 0 || Number(inv.total) % 1 === 0, lines: lines.length ? lines : [blankLine()] })
  }

  function pickParty(name) {
    const led = partyByName[name.trim().toLowerCase()]
    const p = led?.partner_id ? partners[led.partner_id] : null
    setForm((f) => {
      const next = { ...f, party: name }
      if (p) {
        next.gstin = p.gstin || ''
        next.pos = p.bill_to_state || f.pos
        next.supply = suggestSupply(p.bill_to_state, p.gstin, f.supply)
      }
      return next
    })
  }
  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) }))

  const calc = useMemo(() => (form ? calcInvoice(form.lines, form.supply, form.round) : null), [form])
  const ro = form && !canWrite

  async function save() {
    const led = partyByName[form.party.trim().toLowerCase()]
    if (!led) return toast.error(`Party "${form.party || '(blank)'}" was not found. Choose from the list, or sync vendors / customers in the Ledgers tab.`)
    if (!form.invoiceNo.trim()) return toast.error('Enter the invoice number')
    if (form.lines.some((l) => !l.description.trim() || !(Number(l.qty) > 0))) return toast.error('Every item needs a description and a quantity')
    if (!(calc.taxable > 0)) return toast.error('Enter the item rates')
    setSaving(true)
    try {
      const { ids, created } = await ensureInvoiceLedgers(company, kind, groups, ledgers)
      await saveInvoice({ id: form.id, company, kind, date: form.date, invoiceNo: form.invoiceNo, party: led.id, gstin: form.gstin, pos: form.pos,
        supply: form.supply, due: form.due, reference: form.reference, narration: form.narration, lines: form.lines, ledgers: ids, round: form.round })
      toast.success(`${kind} invoice saved and posted to the books`)
      setForm(null)
      if (created) reload()
      load()
    } catch (e) { toast.error(e.message || 'Could not save') } finally { setSaving(false) }
  }

  async function remove() {
    try { await deleteVoucher(toDelete.voucher_id); toast.success('Invoice deleted'); setToDelete(null); load() }
    catch (e) { toast.error(e.message); setToDelete(null) }
  }

  function exportRegister() {
    if (!shown.length) return toast.info('Nothing to export')
    const head = ['Date', 'Invoice No', kind === 'Sales' ? 'Customer' : 'Supplier', 'GSTIN', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round Off', 'Total']
    const rows = shown.map((i) => [dmy(i.invoice_date), i.invoice_no, nameById[i.party_ledger_id] || '', i.party_gstin || '', i.place_of_supply || '',
      Number(i.taxable), Number(i.cgst), Number(i.sgst), Number(i.igst), Number(i.round_off), Number(i.total)])
    rows.push(['', '', 'Total', '', '', sums.taxable, sums.cgst, sums.sgst, sums.igst, '', sums.total])
    const ws = XLSX.utils.aoa_to_sheet([[`${companyName} - ${kind} Register FY ${fy}`], [], head, ...rows])
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 30 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `${kind} Register`)
    XLSX.writeFile(wb, `${kind}-Register-${fy}.xlsx`)
  }

  function printInvoice(inv) {
    const p = partners[ledgers.find((l) => l.id === inv.party_ledger_id)?.partner_id]
    const lines = [...(inv.acc_invoice_lines || [])].sort((a, b) => a.line_no - b.line_no)
    const addr = p ? [p.bill_to_address_line1, p.bill_to_address_line2, p.bill_to_city, p.bill_to_district, p.bill_to_state, p.bill_to_pin].filter(Boolean).join(', ') : ''
    const title = kind === 'Sales' ? 'TAX INVOICE' : 'PURCHASE INVOICE'
    const intra = inv.supply_type === 'Intra'
    const body = lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.description)}</td><td>${esc(l.hsn)}</td><td class=r>${Number(l.qty)}</td><td>${esc(l.uom)}</td><td class=r>${inr(l.rate)}</td><td class=r>${Number(l.discount_pct) || ''}</td><td class=r>${inr(l.taxable)}</td><td class=r>${Number(l.gst_rate)}%</td></tr>`).join('')
    const row = (label, v) => (Number(v) ? `<tr><td>${label}</td><td class=r>${inr(v)}</td></tr>` : '')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} ${esc(inv.invoice_no)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}h1{font-size:18px;text-align:center;margin:0 0 4px}h2{font-size:14px;text-align:center;margin:0 0 12px}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #444;padding:4px 6px;vertical-align:top}th{background:#eee}.r{text-align:right}.box{display:flex;gap:12px;margin-bottom:10px}.box>div{flex:1;border:1px solid #444;padding:6px}
.tot{width:46%;margin-left:auto;margin-top:8px}.tot td{border:1px solid #444}.sign{margin-top:40px;text-align:right}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right">Print</button>
<h1>${esc(companyName)}</h1><h2>${title}</h2>
<div class=box><div><b>${kind === 'Sales' ? 'Bill To' : 'Supplier'}</b><br>${esc(nameById[inv.party_ledger_id])}<br>${esc(addr)}<br>GSTIN: ${esc(inv.party_gstin || '-')}</div>
<div>Invoice No: <b>${esc(inv.invoice_no)}</b><br>Date: ${dmy(inv.invoice_date)}<br>${inv.due_date ? `Due Date: ${dmy(inv.due_date)}<br>` : ''}Place of Supply: ${esc(inv.place_of_supply || '-')}<br>${inv.reference ? `Ref: ${esc(inv.reference)}` : ''}</div></div>
<table><thead><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>UOM</th><th>Rate</th><th>Disc %</th><th>Taxable</th><th>GST</th></tr></thead><tbody>${body}</tbody></table>
<table class=tot><tbody><tr><td>Taxable Value</td><td class=r>${inr(inv.taxable)}</td></tr>${intra ? row('CGST', inv.cgst) + row('SGST', inv.sgst) : row('IGST', inv.igst)}${row('Round Off', inv.round_off)}<tr><td><b>Total</b></td><td class=r><b>${inr(inv.total)}</b></td></tr></tbody></table>
<p><b>Amount in words:</b> ${esc(amountInWords(inv.total))}</p>${inv.narration ? `<p>${esc(inv.narration)}</p>` : ''}
<div class=sign>For ${esc(companyName)}<br><br><br>Authorised Signatory</div><script>setTimeout(function(){window.print()},300)</script></body></html>`
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups for this site to print')
    w.document.write(html); w.document.close()
  }

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="flex overflow-hidden rounded-lg border border-navy-100">
          {['Sales', 'Purchase'].map((k) => (
            <button key={k} onClick={() => { setKind(k); setQ('') }} className={`px-4 py-2 text-sm font-semibold ${kind === k ? 'bg-navy text-white' : 'bg-white text-navy-500 hover:bg-navy-50'}`}>{k}</button>
          ))}
        </div>
        {canWrite && <button className="btn-gold" onClick={openNew}><Plus size={16} /> New {kind} Invoice</button>}
        <input className="input max-w-xs flex-1" placeholder="Search invoice no, party, GSTIN..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-outline" onClick={exportRegister}><FileSpreadsheet size={16} /> Export Register</button>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <LoadingSpinner /> : (
          <table className="table-base">
            <thead><tr><th>Date</th><th>Invoice No</th><th>{kind === 'Sales' ? 'Customer' : 'Supplier'}</th><th>GSTIN</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th><th></th></tr></thead>
            <tbody>
              {shown.map((i) => (
                <tr key={i.id}>
                  <td className="text-xs">{dmy(i.invoice_date)}</td>
                  <td className="text-xs font-semibold text-navy-500">{i.invoice_no}</td>
                  <td className="text-xs">{nameById[i.party_ledger_id] || '-'}</td>
                  <td className="text-xs">{i.party_gstin || '-'}</td>
                  <td className="text-right text-xs tabular-nums">{inr(i.taxable)}</td>
                  <td className="text-right text-xs tabular-nums">{inr(i.cgst)}</td>
                  <td className="text-right text-xs tabular-nums">{inr(i.sgst)}</td>
                  <td className="text-right text-xs tabular-nums">{inr(i.igst)}</td>
                  <td className="text-right text-xs font-semibold tabular-nums">{inr(i.total)}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="text-navy-400 hover:text-navy" title={canWrite ? 'Edit' : 'View'} onClick={() => openExisting(i)}><Eye size={14} /></button>
                      <button className="text-navy-400 hover:text-navy" title="Print" onClick={() => printInvoice(i)}><Printer size={14} /></button>
                      {canDelete && <button className="text-navy-400 hover:text-brick" onClick={() => setToDelete(i)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={10} className="py-8 text-center text-sm text-navy-400">No {kind.toLowerCase()} invoices in FY {fy}.</td></tr>}
              {shown.length > 0 && (
                <tr className="border-t border-navy-300 font-bold text-navy">
                  <td colSpan={4} className="text-right text-xs">Total ({shown.length})</td>
                  <td className="text-right text-xs tabular-nums">{inr(sums.taxable)}</td><td className="text-right text-xs tabular-nums">{inr(sums.cgst)}</td>
                  <td className="text-right text-xs tabular-nums">{inr(sums.sgst)}</td><td className="text-right text-xs tabular-nums">{inr(sums.igst)}</td>
                  <td className="text-right text-xs tabular-nums">{inr(sums.total)}</td><td></td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden bg-white !p-0">
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold text-white">{kind} Invoice <span className="font-normal text-white/60">- {form.id ? (ro ? 'View' : 'Edit') : 'New'}</span></h3>
              <button onClick={() => setForm(null)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <fieldset disabled={ro} className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-2"><label className="label">{kind === 'Sales' ? 'Customer *' : 'Supplier *'}</label>
                    <input className={`input ${form.party && !partyByName[form.party.trim().toLowerCase()] ? 'border-brick' : ''}`} list="inv-party" placeholder="Type to search" value={form.party} onChange={(e) => pickParty(e.target.value)} />
                    <datalist id="inv-party">{partyLedgers.map((l) => <option key={l.id} value={l.name} />)}</datalist>
                  </div>
                  <div><label className="label">{kind === 'Sales' ? 'Invoice No *' : 'Supplier Invoice No *'}</label><input className="input" value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></div>
                  <div><label className="label">Invoice Date *</label><input type="date" className="input" min={range.from} max={range.to} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><label className="label">Party GSTIN</label><input className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></div>
                  <div><label className="label">Place of Supply</label>
                    <select className="input" value={form.pos} onChange={(e) => setForm({ ...form, pos: e.target.value, supply: suggestSupply(e.target.value, form.gstin, form.supply) })}>
                      <option value="">Select state</option>{INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                    </select></div>
                  <div><label className="label">GST type</label>
                    <select className="input" value={form.supply} onChange={(e) => setForm({ ...form, supply: e.target.value })}>
                      <option value="Intra">Same state (CGST + SGST)</option><option value="Inter">Other state (IGST)</option>
                    </select></div>
                  <div><label className="label">Due Date</label><input type="date" className="input" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></div>
                </div>

                <div>
                  <label className="label">Items</label>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] text-xs">
                      <thead><tr className="text-left text-navy-400"><th className="w-8">#</th><th>Description</th><th className="w-24">HSN/SAC</th><th className="w-20">Qty</th><th className="w-20">UOM</th><th className="w-24">Rate</th><th className="w-16">Disc %</th><th className="w-20">GST %</th><th className="w-28 text-right">Taxable</th><th className="w-6"></th></tr></thead>
                      <tbody>
                        {form.lines.map((l, i) => (
                          <tr key={i}>
                            <td>{i + 1}</td>
                            <td><input className="input" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                            <td><input className="input" value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} /></td>
                            <td><input type="number" min="0" step="0.001" className="input" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                            <td><input className="input" list="inv-uom" value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })} /></td>
                            <td><input type="number" min="0" step="0.01" className="input" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} /></td>
                            <td><input type="number" min="0" max="100" step="0.01" className="input" value={l.discount_pct} onChange={(e) => setLine(i, { discount_pct: e.target.value })} /></td>
                            <td><select className="input" value={l.gst_rate} onChange={(e) => setLine(i, { gst_rate: e.target.value })}>{GST_RATES.map((g) => <option key={g} value={g}>{g}%</option>)}</select></td>
                            <td className="text-right tabular-nums">{inr(calc.rows[i]?.taxable)}</td>
                            <td>{!ro && form.lines.length > 1 && <button type="button" className="text-brick" onClick={() => setForm({ ...form, lines: form.lines.filter((_, k) => k !== i) })}><Trash2 size={14} /></button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <datalist id="inv-uom">{UOMS.map((u) => <option key={u} value={u} />)}</datalist>
                  {!ro && <button type="button" className="mt-2 text-xs font-semibold text-navy-500 hover:text-navy" onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}>+ Add item</button>}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div><label className="label">Reference / PO No.</label><input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
                    <div><label className="label">Narration</label><input className="input" value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} /></div>
                    <label className="flex items-center gap-2 text-xs text-navy-500"><input type="checkbox" checked={form.round} onChange={(e) => setForm({ ...form, round: e.target.checked })} /> Round off to the nearest rupee</label>
                  </div>
                  <div className="rounded-lg bg-navy-50 p-3 text-sm">
                    <div className="flex justify-between"><span>Taxable value</span><span className="tabular-nums">{inr(calc.taxable)}</span></div>
                    {form.supply === 'Intra' ? (
                      <>
                        <div className="flex justify-between"><span>CGST</span><span className="tabular-nums">{inr(calc.cgst)}</span></div>
                        <div className="flex justify-between"><span>SGST</span><span className="tabular-nums">{inr(calc.sgst)}</span></div>
                      </>
                    ) : <div className="flex justify-between"><span>IGST</span><span className="tabular-nums">{inr(calc.igst)}</span></div>}
                    {calc.roundOff !== 0 && <div className="flex justify-between"><span>Round off</span><span className="tabular-nums">{inr(calc.roundOff)}</span></div>}
                    <div className="mt-1 flex justify-between border-t border-navy-200 pt-1 font-bold text-navy"><span>Total</span><span className="tabular-nums">{inr(calc.total)}</span></div>
                    <p className="mt-1 text-[11px] text-navy-400">{amountInWords(calc.total)}</p>
                  </div>
                </div>
              </fieldset>
              <p className="text-[11px] text-navy-400">
                {kind === 'Sales' ? 'Posts: Customer debit; Sales and Output GST credit.' : 'Posts: Purchases and Input GST debit; Supplier credit.'} Ledgers named {kind === 'Sales' ? 'Sales, Output CGST/SGST/IGST' : 'Purchases, Input CGST/SGST/IGST'} and Round Off are created automatically the first time.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button className="btn-outline" onClick={() => setForm(null)}>{ro ? 'Close' : 'Cancel'}</button>
              {!ro && <button className="btn-primary" disabled={saving} onClick={save}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save &amp; Post</button>}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this invoice?" message={`${kind} invoice ${toDelete?.invoice_no} and its entries in the books will be removed permanently.`}
        confirmLabel="Delete" danger onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  )
}
