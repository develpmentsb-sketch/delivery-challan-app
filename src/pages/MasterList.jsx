import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, FileSpreadsheet, FileText, Printer, RotateCcw, Trash2, Plus } from 'lucide-react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import StatusBadge from '../components/StatusBadge'
import Pagination from '../components/Pagination'
import ConfirmDialog from '../components/ConfirmDialog'
import { listChallans, deleteChallan, getChallan } from '../services/challanService'
import { listLocations } from '../lib/locations'
import { formatCurrency } from '../utils/calculations'
import { exportChallansToExcel, exportChallansToCSV } from '../utils/excelExport'
import { openChallanPrintView } from '../utils/pdfGenerator'
import { DC_STATUSES, INDIAN_STATES } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 10

const emptyFilters = {
  search: '', dateFrom: '', dateTo: '', gstin: '', dcNumber: '', ewayBillNumber: '', vehicleNumber: '', state: '', status: 'All', locationId: ''
}

export default function MasterList() {
  const toast = useToast()
  const { can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [all, setAll] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [toDelete, setToDelete] = useState(null)
  const [locations, setLocations] = useState([])
  const [groupByCompany, setGroupByCompany] = useState(true)

  async function load(f = appliedFilters) {
    setLoading(true)
    try {
      const rows = await listChallans(f)
      setAll(rows)
    } catch (err) {
      toast.error(err.message || 'Failed to load master list')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(emptyFilters) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listLocations().then(setLocations).catch(() => {}) }, [])

  const handleSearch = () => { setAppliedFilters(filters); setPage(1); load(filters) }
  const handleClear = () => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(1); load(emptyFilters) }

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return all.slice(start, start + PAGE_SIZE)
  }, [all, page])

  const companyName = (c) => c.dispatch_from_snapshot?.company_name || c.dispatch_from_snapshot?.location_name || 'Unassigned / Head Office'

  // Company-wise view: every matching row (not just the current page),
  // bucketed under its company with a subtotal row per company.
  const groups = useMemo(() => {
    const byCompany = new Map()
    for (const c of all) {
      const key = companyName(c)
      if (!byCompany.has(key)) byCompany.set(key, [])
      byCompany.get(key).push(c)
    }
    return [...byCompany.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([company, rows]) => ({
        company,
        rows,
        totals: rows.reduce(
          (acc, r) => ({
            items: acc.items + (r.delivery_challan_items?.length || 0),
            qty: acc.qty + Number(r.total_quantity || 0),
            taxable: acc.taxable + Number(r.taxable_value || 0),
            gst: acc.gst + Number(r.cgst || 0) + Number(r.sgst || 0) + Number(r.igst || 0),
            grandTotal: acc.grandTotal + Number(r.grand_total || 0)
          }),
          { items: 0, qty: 0, taxable: 0, gst: 0, grandTotal: 0 }
        )
      }))
  }, [all])

  async function handleDelete() {
    try {
      await deleteChallan(toDelete.id)
      toast.success(`${toDelete.dc_number} deleted`)
      setToDelete(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  async function handlePrint(row, mode) {
    try {
      const c = await getChallan(row.id)
      openChallanPrintView(c, c.delivery_challan_items, c.eway_bills?.[0], mode)
    } catch (err) {
      toast.error(err.message || 'Failed to open print view')
    }
  }

  function renderRow(c) {
    return (
      <tr key={c.id}>
        <td className="font-medium text-navy">
          {can('challan.edit')
            ? <Link to={`/challan/${c.id}/edit`} className="hover:underline">{c.dc_number}</Link>
            : c.dc_number}
        </td>
        <td>{c.dc_date}</td>
        <td className="text-xs">{companyName(c)}</td>
        <td>{c.partners?.name || c.bill_to_snapshot?.name || '-'}</td>
        <td className="text-xs">{c.bill_to_snapshot?.gstin || '-'}</td>
        <td className="text-xs">{c.bill_to_snapshot?.state || '-'}</td>
        <td className="text-xs">{c.ship_to_snapshot?.state || '-'}</td>
        <td className="text-right">{c.delivery_challan_items?.length || 0}</td>
        <td className="text-right">{c.total_quantity}</td>
        <td className="text-right">{formatCurrency(c.taxable_value)}</td>
        <td className="text-right">{formatCurrency((c.cgst || 0) + (c.sgst || 0) + (c.igst || 0))}</td>
        <td className="text-right font-semibold">{formatCurrency(c.grand_total)}</td>
        <td>{c.vehicle_number || '-'}</td>
        <td className="text-xs">{c.eway_bills?.[0]?.eway_bill_number || '-'}</td>
        <td><StatusBadge status={c.eway_bills?.[0]?.status || 'Not Generated'} /></td>
        <td><StatusBadge status={c.dc_status} /></td>
        <td className="text-xs">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
        <td>
          <div className="flex gap-1">
            <button title="Print" onClick={() => handlePrint(c, 'print')} className="text-navy-400 hover:text-navy"><Printer size={15} /></button>
            <button title="Download PDF" onClick={() => handlePrint(c, 'pdf')} className="text-navy-400 hover:text-navy"><FileText size={15} /></button>
            {can('challan.delete') && (
              <button title="Delete" onClick={() => setToDelete(c)} className="text-navy-400 hover:text-brick"><Trash2 size={15} /></button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div>
      <Header
        title="Master List"
        subtitle="All Delivery Challans in one place"
        actions={can('challan.create') && <Link to="/challan/new" className="btn-gold"><Plus size={16} /> Create Delivery Challan</Link>}
      />

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="grid md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-3 text-navy-300" />
            <input className="input pl-8" placeholder="Search customer, DC No., GSTIN..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <input type="date" className="input" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} placeholder="Date From" />
          <input type="date" className="input" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} placeholder="Date To" />
          <input className="input" placeholder="DC Number" value={filters.dcNumber} onChange={(e) => setFilters({ ...filters, dcNumber: e.target.value })} />
          <input className="input" placeholder="GSTIN" value={filters.gstin} onChange={(e) => setFilters({ ...filters, gstin: e.target.value })} />
          <input className="input" placeholder="E-Way Bill Number" value={filters.ewayBillNumber} onChange={(e) => setFilters({ ...filters, ewayBillNumber: e.target.value })} />
          <input className="input" placeholder="Vehicle Number" value={filters.vehicleNumber} onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })} />
          <select className="input" value={filters.state} onChange={(e) => setFilters({ ...filters, state: e.target.value })}>
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
          </select>
          <select className="input" value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}>
            <option value="">All Companies</option>
            <option value="__head">Head Office</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.legal_name || l.location_name}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="All">All Statuses</option>
            {DC_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button className="btn-primary" onClick={handleSearch}><Search size={16} /> Search</button>
          <button className="btn-outline" onClick={handleClear}><RotateCcw size={16} /> Clear Filters</button>
          <label className="flex items-center gap-2 text-sm text-navy-600 ml-2 cursor-pointer select-none">
            <input type="checkbox" checked={groupByCompany} onChange={(e) => { setGroupByCompany(e.target.checked); setPage(1) }} />
            Group by Company
          </label>
          <div className="ml-auto flex gap-2">
            <button className="btn-outline" onClick={() => (all.length ? exportChallansToExcel(all) : toast.info('No records to export'))}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button className="btn-outline" onClick={() => (all.length ? exportChallansToCSV(all) : toast.info('No records to export'))}>
              <FileText size={16} /> Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : all.length === 0 ? (
          <EmptyState title="No delivery challans found" description="Try adjusting your filters, or create a new delivery challan." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base min-w-[1400px]">
                <thead>
                  <tr>
                    <th>DC No.</th><th>Date</th><th>Company</th><th>Vendor</th><th>GSTIN</th>
                    <th>Bill To State</th><th>Ship To State</th><th className="text-right">Items</th>
                    <th className="text-right">Qty</th><th className="text-right">Taxable</th>
                    <th className="text-right">GST</th><th className="text-right">Grand Total</th>
                    <th>Vehicle No.</th><th>E-Way Bill No.</th><th>E-Way Status</th><th>DC Status</th><th>Created</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {groupByCompany
                    ? groups.map((g) => (
                        <React.Fragment key={g.company}>
                          <tr className="bg-navy-50">
                            <td colSpan={18} className="font-semibold text-navy py-2">
                              {g.company} <span className="font-normal text-navy-400 text-xs">({g.rows.length} DC{g.rows.length === 1 ? '' : 's'})</span>
                            </td>
                          </tr>
                          {g.rows.map((c) => renderRow(c))}
                          <tr className="bg-cream-100 font-semibold">
                            <td colSpan={7} className="text-right text-xs text-navy-500">Subtotal - {g.company}</td>
                            <td className="text-right">{g.totals.items}</td>
                            <td className="text-right">{g.totals.qty}</td>
                            <td className="text-right">{formatCurrency(g.totals.taxable)}</td>
                            <td className="text-right">{formatCurrency(g.totals.gst)}</td>
                            <td className="text-right">{formatCurrency(g.totals.grandTotal)}</td>
                            <td colSpan={6}></td>
                          </tr>
                        </React.Fragment>
                      ))
                    : paged.map((c) => renderRow(c))}
                </tbody>
              </table>
            </div>
            {!groupByCompany && <Pagination page={page} pageSize={PAGE_SIZE} total={all.length} onPageChange={setPage} />}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this Delivery Challan?"
        message={`This will permanently delete ${toDelete?.dc_number}. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
