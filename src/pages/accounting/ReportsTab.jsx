import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { FileSpreadsheet, Printer, Save } from 'lucide-react'
import LoadingSpinner from '../../components/LoadingSpinner'
import ReportTable from './ReportTable'
import { useToast } from '../../context/ToastContext'
import { getTotals, getStockValues, saveClosingStock, listVouchers } from '../../services/accountingService'
import * as A from '../../utils/accounting'

const REPORTS = [
  ['tb', 'Trial Balance'], ['pl', 'Trading & Profit & Loss'], ['bs', 'Balance Sheet (Schedule III)'],
  ['cf', 'Cash Flow'], ['ratios', 'Ratios'], ['ledger', 'Ledger']
]
const dmy = (s) => (s ? `${s.slice(8, 10)}-${s.slice(5, 7)}-${s.slice(0, 4)}` : '')

export default function ReportsTab({ company, companyName, fy, settings, groups, ledgers, canWrite, command, onCommandDone }) {
  const toast = useToast()
  const range = A.fyRange(fy)
  const [report, setReport] = useState('bs')
  const [asOn, setAsOn] = useState(range.to)
  const [detail, setDetail] = useState(false)
  const [ledgerName, setLedgerName] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [closingInput, setClosingInput] = useState('')
  const [version, setVersion] = useState(0)

  useEffect(() => { setAsOn(A.fyRange(fy).to) }, [fy])
  // Menu commands (Modules > Financial Reports > Trial Balance ...)
  useEffect(() => {
    if (!command) return
    if (command.name === 'report') setReport(command.arg)
    onCommandDone?.()
  }, [command]) // eslint-disable-line react-hooks/exhaustive-deps

  const gi = useMemo(() => A.indexGroups(groups), [groups])
  const infos = useMemo(() => A.ledgerInfos(ledgers, gi), [ledgers, gi])

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const needVouchers = report === 'cf' || report === 'ledger'
        const [totals, stockMap, vouchers] = await Promise.all([
          getTotals(company, range.from, asOn), getStockValues(company),
          needVouchers ? listVouchers(company, range.from, asOn) : Promise.resolve([])
        ])
        if (!alive) return
        setData({ totals, stockMap, vouchers })
        setClosingInput(String(stockMap[fy] ?? ''))
      } catch (e) { if (alive) toast.error(e.message || 'Could not load the report') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [company, fy, asOn, report, version]) // eslint-disable-line react-hooks/exhaustive-deps

  const built = useMemo(() => {
    if (!data) return null
    const meta = { subtitle: `${companyName} | FY ${fy} | ${dmy(range.from)} to ${dmy(asOn)}` }
    const bal = A.balances(infos, data.totals)
    const st = A.stockContext(infos, bal, { fy, booksStart: settings.books_start, closingByFy: data.stockMap })
    const pl = A.profitAndLoss(infos, bal, st)
    const bs = A.scheduleIII(infos, bal, st, pl)
    switch (report) {
      case 'tb': return A.trialBalance(infos, bal, meta)
      case 'pl': return A.plReport(pl, meta)
      case 'bs': return A.bsReport(bs, { subtitle: `${companyName} | As on ${dmy(asOn)}` }, detail)
      case 'cf': {
        const cf = A.cashFlow(infos, bal, data.vouchers, range.from, asOn)
        return { title: 'Cash Flow Statement', subtitle: meta.subtitle, columns: [{ label: 'Particulars' }, { label: 'Amount (Rs)', align: 'right' }], rows: cf.rows }
      }
      case 'ratios': return A.ratiosReport(A.ratios(pl, bs), meta)
      case 'ledger': {
        const info = infos.find((l) => l.name.toLowerCase() === ledgerName.trim().toLowerCase())
        if (!info) return null
        const nameById = Object.fromEntries(infos.map((l) => [l.id, l.name]))
        return A.ledgerReport(info, bal[info.id], data.vouchers, nameById, range.from, asOn, meta)
      }
      default: return null
    }
  }, [data, report, detail, ledgerName, infos, asOn, fy, companyName, settings]) // eslint-disable-line react-hooks/exhaustive-deps

  async function saveStock() {
    try { await saveClosingStock(company, fy, closingInput); toast.success('Closing stock saved'); setVersion((v) => v + 1) }
    catch (e) { toast.error(e.message || 'Could not save') }
  }
  function exportExcel() {
    if (!built) return
    const ws = XLSX.utils.aoa_to_sheet(A.reportToAoa(built))
    ws['!cols'] = built.columns.map((_, i) => ({ wch: i === 0 ? 46 : 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, built.title.slice(0, 28).replace(/[\\/?*[\]:]/g, ''))
    XLSX.writeFile(wb, `${built.title.replace(/[^\w ]/g, '')} ${fy}.xlsx`)
  }
  function printPdf() {
    if (!built) return
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups for this site, then try again')
    w.document.write(A.reportToHtml(built, companyName)); w.document.close(); w.focus()
    setTimeout(() => w.print(), 400)
  }

  const showStock = ['pl', 'bs', 'ratios'].includes(report)
  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div><label className="label">Report</label>
          <select className="input min-w-[220px]" value={report} onChange={(e) => setReport(e.target.value)}>{REPORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        </div>
        <div><label className="label">As on</label><input type="date" className="input" min={range.from} max={range.to} value={asOn} onChange={(e) => setAsOn(e.target.value || range.to)} /></div>
        {report === 'ledger' && (
          <div><label className="label">Ledger</label>
            <input className="input min-w-[220px]" list="rep-ledgers" placeholder="Type to search" value={ledgerName} onChange={(e) => setLedgerName(e.target.value)} />
            <datalist id="rep-ledgers">{ledgers.map((l) => <option key={l.id} value={l.name} />)}</datalist>
          </div>
        )}
        {report === 'bs' && <label className="flex items-center gap-2 pb-2 text-xs text-navy-500"><input type="checkbox" checked={detail} onChange={(e) => setDetail(e.target.checked)} /> Show ledger details</label>}
        {showStock && (
          <div className="flex items-end gap-2">
            <div><label className="label">Closing stock for FY {fy} (Rs)</label><input type="number" min="0" step="0.01" className="input w-44" disabled={!canWrite} value={closingInput} onChange={(e) => setClosingInput(e.target.value)} /></div>
            {canWrite && <button className="btn-outline" onClick={saveStock}><Save size={16} /> Save</button>}
          </div>
        )}
        <div className="ml-auto flex gap-2">
          <button className="btn-outline" disabled={!built} onClick={exportExcel}><FileSpreadsheet size={16} /> Excel</button>
          <button className="btn-outline" disabled={!built} onClick={printPdf}><Printer size={16} /> Print / PDF</button>
        </div>
      </div>

      <div className="card p-5">
        {loading ? <LoadingSpinner /> : built ? <ReportTable report={built} /> : (
          <p className="py-8 text-center text-sm text-navy-400">{report === 'ledger' ? 'Choose a ledger above to see its account.' : 'Nothing to show.'}</p>
        )}
        {report === 'pl' && !loading && <p className="mt-3 text-xs text-navy-400">Opening stock is the previous year's closing stock (or the Stock-in-Hand opening balance in the first year).</p>}
      </div>
    </div>
  )
}
