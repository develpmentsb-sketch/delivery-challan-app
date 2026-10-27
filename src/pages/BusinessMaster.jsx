import React, { useEffect, useMemo, useState } from 'react'
import { Search, FileSpreadsheet, Trash2 } from 'lucide-react'
import * as XLSX from 'xlsx'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import Pagination from '../components/Pagination'
import PartnerLedgerModal from '../components/PartnerLedgerModal'
import { listPartners, getPartnerBalances, deletePartner, getDeleteBlocks } from '../services/partnerService'
import { listLocations } from '../lib/locations'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 15
const inr = (n) => Math.abs(Number(n || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const drcr = (n) => (Math.abs(n) < 0.005 ? 'Nil' : `${inr(n)} ${n >= 0 ? 'Dr' : 'Cr'}`)

// One business partner can be a customer, a vendor, or both (same GSTIN or same name).
function mergePartners(list, balOf) {
  const groups = new Map()
  list.forEach((p) => {
    const key = p.gstin ? `g:${p.gstin.trim().toUpperCase()}` : `n:${p.name.trim().toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(p)
  })
  return [...groups.values()].map((recs) => {
    const cust = recs.filter((r) => r.partner_type === 'Customer')
    const vend = recs.filter((r) => r.partner_type === 'Vendor')
    const first = cust[0] || vend[0]
    const sum = (rs) => rs.reduce((s, r) => s + balOf(r.id), 0)
    const hasLedger = (rs) => rs.some((r) => balOf(r.id, true))
    return {
      key: first.id, name: first.name, gstin: first.gstin || '', pan: first.pan || '', state: first.bill_to_state || '',
      phone: first.phone || first.email || '', company_location_id: first.company_location_id,
      status: first.vendor_status || (first.active ? 'Active' : 'On Hold'),
      role: cust.length && vend.length ? 'Customer & Vendor' : cust.length ? 'Customer' : 'Vendor',
      custCode: cust[0]?.vendor_code || '', vendCode: vend[0]?.vendor_code || '',
      cust: cust[0] || null, vend: vend[0] || null,
      custBal: cust.length ? sum(cust) : null, vendBal: vend.length ? sum(vend) : null,
      custLedger: hasLedger(cust), vendLedger: hasLedger(vend)
    }
  }).sort((a, b) => a.name.localeCompare(b.name))
}

export default function BusinessMaster() {
  const toast = useToast()
  const { can } = useAuth()
  const canDelete = can('partners.delete')
  const [reloadKey, setReloadKey] = useState(0)
  const [blocks, setBlocks] = useState({})
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const [bals, setBals] = useState({})
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [onlyBal, setOnlyBal] = useState(false)
  const [page, setPage] = useState(1)
  const [ledgerFor, setLedgerFor] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const [ps, b, locs] = await Promise.all([listPartners({ type: 'All' }), getPartnerBalances().catch(() => []), listLocations().catch(() => [])])
        setPartners(ps); setLocations(locs)
        setBlocks(await getDeleteBlocks('partners', ps.map((x) => x.id)))
        const m = {}
        b.forEach((x) => { m[x.partner_id] = (m[x.partner_id] || 0) + Number(x.balance); m[`has:${x.partner_id}`] = true })
        setBals(m)
      } catch (e) { toast.error(e.message || 'Could not load the business partners') } finally { setLoading(false) }
    })()
  }, [reloadKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const locName = useMemo(() => Object.fromEntries(locations.map((l) => [l.id, l.legal_name || l.location_name])), [locations])
  const rows = useMemo(() => mergePartners(partners, (id, flag) => (flag ? Boolean(bals[`has:${id}`]) : bals[id] || 0)), [partners, bals])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter((r) => {
      if (role === 'Customer' && !r.cust) return false
      if (role === 'Vendor' && !r.vend) return false
      if (company === 'all' ? r.company_location_id : company && r.company_location_id !== company) return false
      if (onlyBal && !((r.custBal && Math.abs(r.custBal) > 0.004) || (r.vendBal && Math.abs(r.vendBal) > 0.004))) return false
      if (!q) return true
      return `${r.name} ${r.gstin} ${r.pan} ${r.custCode} ${r.vendCode} ${r.phone} ${r.state}`.toLowerCase().includes(q)
    })
  }, [rows, search, role, company, onlyBal])

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  // Receivable = customers who owe us (debit). Payable = vendors we owe (credit).
  const receivable = rows.reduce((s, r) => s + (r.custBal > 0 ? r.custBal : 0), 0)
  const payable = rows.reduce((s, r) => s + (r.vendBal < 0 ? -r.vendBal : 0), 0)

  function exportExcel() {
    if (!filtered.length) return toast.info('Nothing to export')
    const head = ['Customer Code', 'Vendor Code', 'Name', 'Role', 'GSTIN', 'PAN', 'State', 'Contact', 'Company', 'Status', 'Customer Balance', 'Vendor Balance', 'Net Balance']
    const data = filtered.map((r) => [r.custCode, r.vendCode, r.name, r.role, r.gstin, r.pan, r.state, r.phone, r.company_location_id ? (locName[r.company_location_id] || '') : 'All Companies', r.status,
      r.custBal === null ? '' : drcr(r.custBal), r.vendBal === null ? '' : drcr(r.vendBal), drcr((r.custBal || 0) + (r.vendBal || 0))])
    const ws = XLSX.utils.aoa_to_sheet([head, ...data])
    ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Business Master')
    XLSX.writeFile(wb, 'Business-Master.xlsx')
  }

  async function removeRow(r) {
    const recs = [r.cust, r.vend].filter(Boolean)
    const why = recs.map((p) => blocks[p.id]).find(Boolean)
    if (why) return toast.info(why)
    const msg = `Are you sure you want to delete this record?\n\n"${r.name}" (${r.role})\nThis cannot be undone.`
    if (!window.confirm(msg)) return
    try {
      for (const p of recs) await deletePartner(p.id)
      toast.success('Deleted')
      setReloadKey((n) => n + 1)
    } catch (e) { toast.error(e.message || 'Could not delete (it may be used in a delivery challan)') }
  }

  // Clicking anywhere on a row opens that party's ledger statement
  function openLedger(r) {
    const pick = [[r.cust, r.custLedger, r.custBal], [r.vend, r.vendLedger, r.vendBal]].filter((x) => x[0] && x[1])
    if (!pick.length) return toast.info('No accounting ledger yet. Open Accounting > Ledgers and use "Sync customers & vendors" first.')
    pick.sort((a, b) => Math.abs(b[2] || 0) - Math.abs(a[2] || 0))
    setLedgerFor(pick[0][0])
  }

  const balCell = (bal, partner, hasLedger) => {
    if (bal === null) return <span className="text-navy-300">-</span>
    if (!hasLedger) return <span className="text-navy-300" title="No accounting ledger yet - sync parties in Accounting > Ledgers">-</span>
    return (
      <button type="button" className={`font-semibold hover:underline ${Math.abs(bal) < 0.005 ? 'text-navy-400' : bal >= 0 ? 'text-forest-600' : 'text-brick'}`} title="Click to open the ledger" onClick={(e) => { e.stopPropagation(); setLedgerFor(partner) }}>
        {drcr(bal)}
      </button>
    )
  }

  return (
    <div>
      <Header
        title="Business Master"
        subtitle="Every customer and vendor in one place, with its ledger balance"
        actions={<button className="btn-outline" onClick={exportExcel}><FileSpreadsheet size={16} /> Export Excel</button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-navy-400">Total receivable</p><p className="mt-1 font-display text-xl font-bold text-forest-600">{inr(receivable)}</p><p className="text-[11px] text-navy-400">Customers owe you</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-navy-400">Total payable</p><p className="mt-1 font-display text-xl font-bold text-brick">{inr(payable)}</p><p className="text-[11px] text-navy-400">You owe vendors</p></div>
        <div className="card p-4"><p className="text-xs font-semibold uppercase text-navy-400">Business partners</p><p className="mt-1 font-display text-xl font-bold text-navy">{rows.length}</p><p className="text-[11px] text-navy-400">{rows.filter((r) => r.cust).length} customers, {rows.filter((r) => r.vend).length} vendors</p></div>
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search size={14} className="absolute left-3 top-3 text-navy-300" />
          <input className="input pl-8" placeholder="Search by code, name, GSTIN, PAN, state..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[180px]" value={role} onChange={(e) => { setRole(e.target.value); setPage(1) }}>
          <option value="">All roles</option><option>Customer</option><option>Vendor</option>
        </select>
        <select className="input max-w-[220px]" value={company} onChange={(e) => { setCompany(e.target.value); setPage(1) }}>
          <option value="">All companies</option><option value="all">Allocated: All Companies</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.legal_name || l.location_name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-xs text-navy-500"><input type="checkbox" checked={onlyBal} onChange={(e) => { setOnlyBal(e.target.checked); setPage(1) }} /> Only with a balance</label>
      </div>

      <div className="card">
        {loading ? <LoadingSpinner /> : !filtered.length ? <EmptyState title="No business partners found" description="Add customers and vendors in their masters." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>Code</th><th>Name</th><th>Role</th><th>GSTIN</th><th>State</th><th>Company</th><th className="text-right">Customer balance</th><th className="text-right">Vendor balance</th><th className="text-right">Net</th><th>Status</th>{canDelete && <th></th>}</tr></thead>
                <tbody>
                  {paged.map((r) => {
                    const net = (r.custBal || 0) + (r.vendBal || 0)
                    const anyLedger = r.custLedger || r.vendLedger
                    return (
                      <tr key={r.key} className="cursor-pointer hover:bg-gold-50" title="Click to open the ledger" onClick={() => openLedger(r)}>
                        <td className="text-xs font-semibold text-navy-500">{[r.custCode, r.vendCode].filter(Boolean).join(' / ') || '-'}</td>
                        <td className="font-medium text-navy hover:underline">{r.name}</td>
                        <td><span className={`badge ${r.role === 'Customer & Vendor' ? 'bg-gold-100 text-gold-700' : r.role === 'Customer' ? 'bg-navy-100 text-navy-600' : 'bg-forest-100 text-forest-600'}`}>{r.role}</span></td>
                        <td className="text-xs">{r.gstin || '-'}</td>
                        <td className="text-xs">{r.state || '-'}</td>
                        <td className="text-xs">{r.company_location_id ? (locName[r.company_location_id] || '-') : 'All Companies'}</td>
                        <td className="text-right text-xs tabular-nums">{balCell(r.custBal, r.cust, r.custLedger)}</td>
                        <td className="text-right text-xs tabular-nums">{balCell(r.vendBal, r.vend, r.vendLedger)}</td>
                        <td className="text-right text-xs font-semibold tabular-nums">{anyLedger ? drcr(net) : <span className="text-navy-300">-</span>}</td>
                        <td><span className={`badge ${r.status === 'Blocked' ? 'bg-brick/10 text-brick' : r.status === 'On Hold' ? 'bg-gold-100 text-gold-700' : 'bg-forest-100 text-forest-600'}`}>{r.status}</span></td>
                        {canDelete && <td>{(() => { const why = [r.cust, r.vend].filter(Boolean).map((p) => blocks[p.id]).find(Boolean); return <button type="button" className={why ? 'cursor-not-allowed text-navy-200' : 'text-navy-300 hover:text-brick'} title={why || 'Delete'} onClick={(e) => { e.stopPropagation(); removeRow(r) }}><Trash2 size={15} /></button> })()}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
          </>
        )}
      </div>

      {ledgerFor && <PartnerLedgerModal partner={ledgerFor} companyNames={locName} onClose={() => setLedgerFor(null)} />}
    </div>
  )
}
