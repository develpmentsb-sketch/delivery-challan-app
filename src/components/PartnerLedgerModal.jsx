import React, { useEffect, useMemo, useState } from 'react'
import { X, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'
import LoadingSpinner from './LoadingSpinner'
import { getPartnerLedger } from '../services/partnerService'

const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (s) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '')
const drcr = (n) => `${inr(Math.abs(n))} ${n >= 0 ? 'Dr' : 'Cr'}`

// Ledger statement of one customer / vendor, with a running balance.
export default function PartnerLedgerModal({ partner, companyNames, onClose }) {
  const [blocks, setBlocks] = useState(null)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    getPartnerLedger(partner.id).then(setBlocks).catch((e) => setError(e.message || 'Could not load the ledger'))
  }, [partner.id])

  const block = blocks?.[active]
  const view = useMemo(() => {
    if (!block) return null
    const open = (block.ledger.opening_type === 'Cr' ? -1 : 1) * Number(block.ledger.opening_balance || 0)
    const sorted = [...block.entries].sort((a, b) => a.date.localeCompare(b.date) || a.voucher.localeCompare(b.voucher) || a.line - b.line)
    // everything before "from" is rolled into the opening balance
    let run = open
    sorted.filter((e) => from && e.date < from).forEach((e) => { run += e.debit - e.credit })
    const opening = run
    const rows = sorted.filter((e) => (!from || e.date >= from) && (!to || e.date <= to)).map((e) => { run += e.debit - e.credit; return { ...e, balance: run } })
    const dr = rows.reduce((s, r) => s + r.debit, 0)
    const cr = rows.reduce((s, r) => s + r.credit, 0)
    return { opening, rows, dr, cr, closing: run }
  }, [block, from, to])

  function exportExcel() {
    if (!view) return
    const aoa = [[`${partner.name} - Ledger Statement`], [companyNames[block.ledger.company_id] || ''], [],
      ['Date', 'Voucher', 'Particulars', 'Debit', 'Credit', 'Balance'],
      ['', '', 'Opening balance', '', '', drcr(view.opening)],
      ...view.rows.map((r) => [dmy(r.date), r.voucher, r.particulars + (r.narration ? ` - ${r.narration}` : ''), r.debit || '', r.credit || '', drcr(r.balance)]),
      ['', '', 'Total / Closing balance', view.dr, view.cr, drcr(view.closing)]]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    ws['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 46 }, { wch: 14 }, { wch: 14 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger')
    XLSX.writeFile(wb, `Ledger-${partner.name.replace(/[^\w]+/g, '_')}.xlsx`)
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-navy-900/50 p-4">
      <div className="card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white !p-0">
        <div className="flex items-center justify-between bg-navy px-5 py-3">
          <h3 className="text-sm font-semibold text-white">Ledger - {partner.name}</h3>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {error ? <p className="text-sm text-brick">{error}</p> : !blocks ? <LoadingSpinner /> : !blocks.length ? (
            <p className="text-sm text-navy-500">This party has no accounting ledger yet. In Accounting, open Ledgers and use the sync button.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {blocks.length > 1 && (
                  <select className="input max-w-[260px]" value={active} onChange={(e) => setActive(Number(e.target.value))}>
                    {blocks.map((b, i) => <option key={b.ledger.id} value={i}>{companyNames[b.ledger.company_id] || 'Company'}</option>)}
                  </select>
                )}
                {blocks.length === 1 && <span className="text-xs text-navy-400">{companyNames[block.ledger.company_id] || ''}</span>}
                <label className="text-xs text-navy-500">From <input type="date" className="input !inline-block !w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                <label className="text-xs text-navy-500">To <input type="date" className="input !inline-block !w-auto" value={to} onChange={(e) => setTo(e.target.value)} /></label>
                <button className="btn-outline ml-auto" onClick={exportExcel}><FileSpreadsheet size={16} /> Excel</button>
              </div>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>Date</th><th>Voucher</th><th>Particulars</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
                  <tbody>
                    <tr className="bg-navy-50 font-semibold"><td colSpan={5} className="text-xs">Opening balance</td><td className="text-right text-xs tabular-nums">{drcr(view.opening)}</td></tr>
                    {view.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="text-xs">{dmy(r.date)}</td>
                        <td className="text-xs font-semibold text-navy-500">{r.voucher}</td>
                        <td className="max-w-[300px] truncate text-xs" title={r.narration}>{r.particulars}{r.narration ? <span className="text-navy-400"> - {r.narration}</span> : null}</td>
                        <td className="text-right text-xs tabular-nums">{r.debit ? inr(r.debit) : ''}</td>
                        <td className="text-right text-xs tabular-nums">{r.credit ? inr(r.credit) : ''}</td>
                        <td className="text-right text-xs tabular-nums">{drcr(r.balance)}</td>
                      </tr>
                    ))}
                    {!view.rows.length && <tr><td colSpan={6} className="py-6 text-center text-sm text-navy-400">No entries in this period.</td></tr>}
                    <tr className="border-t border-navy-300 font-bold text-navy">
                      <td colSpan={3} className="text-right text-xs">Total / Closing balance</td>
                      <td className="text-right text-xs tabular-nums">{inr(view.dr)}</td><td className="text-right text-xs tabular-nums">{inr(view.cr)}</td>
                      <td className="text-right text-xs tabular-nums">{drcr(view.closing)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end border-t border-navy-100 px-5 py-3"><button className="btn-outline" onClick={onClose}>Close</button></div>
      </div>
    </div>
  )
}
