import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Upload, X, Save, Loader2, Star, ExternalLink } from 'lucide-react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import { listPartners, createPartner, updatePartner, deletePartner, isDuplicateGSTIN, bulkImportPartners } from '../services/partnerService'
import { listLocations } from '../lib/locations'
import { validatePartner } from '../utils/validation'
import { exportPartnersToExcel, readExcelFile } from '../utils/excelExport'
import { INDIAN_STATES } from '../lib/constants'
import { useToast } from '../context/ToastContext'
import { suggestTds } from '../utils/tds'
import { gstinStatus, gstinDetails } from '../utils/gst'

const PAGE_SIZE = 10
const ALL_COMPANIES = 'all'

const VENDOR_STATUSES = ['Active', 'On Hold', 'Blocked']
const GST_TYPES = ['Regular', 'Composition', 'Unregistered', 'SEZ', 'Overseas']
const PAYMENT_TERMS = ['Advance', 'Immediate', 'Net 7', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90']
const TDS_SECTIONS = [
  ['194C', 'Contractors'], ['194J', 'Professional / technical fees'], ['194H', 'Commission / brokerage'],
  ['194I', 'Rent'], ['194Q', 'Purchase of goods'], ['194A', 'Interest'], ['195', 'Payment to non-resident']
]
const TABS = [
  { id: 'general', label: 'General' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'payment', label: 'Payment & Tax' }
]
const statusBadge = (st) =>
  st === 'Blocked' ? 'bg-brick/10 text-brick' : st === 'On Hold' ? 'bg-gold-100 text-gold-700' : 'bg-forest-100 text-forest-600'

const emptyPartner = () => ({
  partner_type: 'Vendor', name: '', short_name: '', gstin: '', pan: '', contact_person: '', phone: '', email: '',
  bill_to_address_line1: '', bill_to_address_line2: '', bill_to_city: '', bill_to_district: '',
  bill_to_state: '', bill_to_state_code: '', bill_to_pin: '', company_location_id: null, active: true,
  vendor_code: '', vendor_group: '', rating: '', vendor_status: 'Active', gst_type: 'Regular', msme_number: '',
  payment_terms: '', credit_days: '', credit_limit: '', tds_section: '', tds_rate: ''
})

const emptyShipTo = () => ({ ship_to_name: '', address_line1: '', address_line2: '', city: '', district: '', state: '', state_code: '', pin_code: '', gstin: '', is_default: false })

export default function PartnerMaster() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const [locations, setLocations] = useState([])
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyPartner())
  const [shipToList, setShipToList] = useState([])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [viewOnly, setViewOnly] = useState(false)
  const [tab, setTab] = useState('general')
  // true while the TDS rate on screen was filled in automatically (so it can follow GSTIN / PAN changes)
  const [tdsAuto, setTdsAuto] = useState(false)

  const tdsHint = useMemo(() => suggestTds(form.tds_section, form.gstin, form.pan), [form.tds_section, form.gstin, form.pan])

  // When the GSTIN or PAN is edited and the rate was auto-filled, refresh it. A rate typed by the user is left alone.
  useEffect(() => {
    if (viewOnly || !tdsAuto || !tdsHint || tdsHint.rate === null) return
    setForm((f) => (String(f.tds_rate) === String(tdsHint.rate) ? f : { ...f, tds_rate: tdsHint.rate }))
  }, [tdsHint, tdsAuto, viewOnly])

  async function load() {
    setLoading(true)
    try {
      const [vendors, locs] = await Promise.all([
        listPartners({ type: 'Vendor' }),
        listLocations().catch(() => [])
      ])
      setPartners(vendors)
      setLocations(locs)
    } catch (err) {
      toast.error(err.message || 'Failed to load Vendor Master')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const vendorGroups = useMemo(
    () => [...new Set(partners.map((p) => p.vendor_group).filter(Boolean))].sort(),
    [partners]
  )

  const locationName = (loc) => loc.legal_name || loc.location_name
  const locationsById = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, locationName(l)])),
    [locations]
  )

  const filtered = useMemo(() => {
    let rows = partners
    if (companyFilter === ALL_COMPANIES) rows = rows.filter((p) => !p.company_location_id)
    else if (companyFilter) rows = rows.filter((p) => p.company_location_id === companyFilter)
    const q = search.toLowerCase()
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.vendor_code?.toLowerCase().includes(q) || p.vendor_group?.toLowerCase().includes(q) || p.gstin?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q) || p.bill_to_state?.toLowerCase().includes(q))
    return rows
  }, [partners, companyFilter, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openCreate() { setEditing(null); setForm(emptyPartner()); setShipToList([]); setErrors({}); setViewOnly(false); setTab('general'); setTdsAuto(false); setModalOpen(true) }
  function openEdit(p) { setEditing(p); setForm(p); setShipToList(p.partner_ship_to || []); setErrors({}); setViewOnly(false); setTab('general'); setTdsAuto(false); setModalOpen(true) }
  function openView(p) { setEditing(p); setForm(p); setShipToList(p.partner_ship_to || []); setErrors({}); setViewOnly(true); setTab('general'); setTdsAuto(false); setModalOpen(true) }

  function addShipTo() { setShipToList((prev) => [...prev, emptyShipTo()]) }
  function updateShipTo(idx, patch) {
    setShipToList((prev) => prev.map((s, i) => {
      if (i !== idx) return patch.is_default ? { ...s, is_default: false } : s
      return { ...s, ...patch }
    }))
  }
  function removeShipTo(idx) { setShipToList((prev) => prev.filter((_, i) => i !== idx)) }

  // Typing a full valid GSTIN fills PAN, State and State Code - only the fields that are still empty.
  function handleGstinChange(raw) {
    const gstin = raw.toUpperCase().replace(/\s/g, '')
    setForm((f) => {
      const next = { ...f, gstin }
      const d = gstinDetails(gstin, INDIAN_STATES)
      if (d) {
        if (!f.pan) next.pan = d.pan
        if (!f.bill_to_state && d.stateName) next.bill_to_state = d.stateName
        if (!f.bill_to_state_code) next.bill_to_state_code = d.stateCode
      }
      return next
    })
  }

  // Copies the GSTIN and opens the official GST portal search page (it needs a captcha, so it has to be done by hand).
  async function openGstPortal() {
    const g = (form.gstin || '').trim()
    try { if (g) await navigator.clipboard.writeText(g) } catch (e) { /* clipboard may be blocked - ignore */ }
    window.open('https://services.gst.gov.in/services/searchtp', '_blank', 'noopener,noreferrer')
    toast.info(g ? 'GSTIN copied - paste it in the GST portal, enter the captcha, then copy the name and address back here' : 'GST portal opened - enter the GSTIN there')
  }

  async function handleSave() {
    const { valid, errors: errs } = validatePartner(form)
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    if (form.credit_limit !== '' && form.credit_limit !== null && !(num(form.credit_limit) >= 0)) errs.credit_limit = 'Enter 0 or more'
    if (form.credit_days !== '' && form.credit_days !== null && !(num(form.credit_days) >= 0)) errs.credit_days = 'Enter 0 or more'
    if (form.tds_rate !== '' && form.tds_rate !== null && !(num(form.tds_rate) >= 0 && num(form.tds_rate) <= 100)) errs.tds_rate = 'Enter 0 to 100'
    if (!valid || Object.keys(errs).length) { setErrors(errs); if (errs.name || errs.gstin || errs.pan) setTab('general'); else if (errs.bill_to_pin) setTab('addresses'); else setTab('payment'); return }
    setSaving(true)
    try {
      if (form.gstin) {
        const dup = await isDuplicateGSTIN(form.gstin, editing?.id)
        if (dup) { setErrors({ gstin: 'This GSTIN is already used by another vendor' }); setSaving(false); return }
      }
      // Clean the new fields: blanks become null, "active" follows the vendor status, the code is automatic
      const { vendor_code, ...rest } = form
      const payload = {
        ...rest,
        ...(editing && vendor_code ? { vendor_code } : {}),
        rating: num(form.rating),
        credit_days: num(form.credit_days),
        credit_limit: num(form.credit_limit),
        tds_rate: num(form.tds_rate),
        vendor_group: form.vendor_group?.trim() || null,
        payment_terms: form.payment_terms || null,
        tds_section: form.tds_section || null,
        msme_number: form.msme_number?.trim() || null,
        active: form.vendor_status === 'Active'
      }
      if (editing) {
        await updatePartner(editing.id, payload, shipToList)
        toast.success('Vendor updated')
      } else {
        await createPartner(payload, shipToList)
        toast.success('Vendor added')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await deletePartner(toDelete.id)
      toast.success('Deleted')
      setToDelete(null)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to delete')
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await readExcelFile(file)
      const result = await bulkImportPartners(rows, locations)
      toast.success(`Imported ${result.imported} new, updated ${result.updated} vendor(s)`)
      load()
    } catch (err) {
      toast.error(err.message || 'Failed to import file')
    } finally {
      e.target.value = ''
    }
  }

  return (
    <div>
      <Header
        title="Vendor Master"
        subtitle="Manage vendors, their addresses, and which company they're allocated to"
        actions={
          <>
            <label className="btn-outline cursor-pointer">
              <Upload size={16} /> Import Excel
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            </label>
            <button className="btn-outline" onClick={() => (partners.length ? exportPartnersToExcel(partners, locationsById) : toast.info('Nothing to export'))}>
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button className="btn-gold" onClick={openCreate}><Plus size={16} /> Add Vendor</button>
          </>
        }
      />

      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-3 text-navy-300" />
          <input className="input pl-8" placeholder="Search by Code, Name, Group, GSTIN, Phone, State..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select className="input max-w-[220px]" value={companyFilter} onChange={(e) => { setCompanyFilter(e.target.value); setPage(1) }}>
          <option value="">All companies (any allocation)</option>
          <option value={ALL_COMPANIES}>Allocated: All Companies</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{locationName(l)}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState title="No records found" description="Add your first vendor, or import a list from Excel." action={<button className="btn-primary mt-2" onClick={openCreate}><Plus size={16} /> Add Vendor</button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Code</th><th>Name</th><th>Group</th><th>Company</th><th>GSTIN</th><th>State</th><th>Bill To</th><th>Default Ship To</th><th>Contact</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => {
                    const def = p.partner_ship_to?.find((s) => s.is_default) || p.partner_ship_to?.[0]
                    return (
                      <tr key={p.id}>
                        <td className="text-xs font-semibold text-navy-500">{p.vendor_code || '-'}</td>
                        <td className="font-medium text-navy">{p.name}</td>
                        <td className="text-xs">{p.vendor_group || '-'}</td>
                        <td><span className={`badge ${p.company_location_id ? 'bg-navy-100 text-navy-600' : 'bg-forest-100 text-forest-600'}`}>{p.company_location_id ? (locationsById[p.company_location_id] || 'Unknown') : 'All Companies'}</span></td>
                        <td className="text-xs">{p.gstin || '-'}</td>
                        <td className="text-xs">{p.bill_to_state || '-'}</td>
                        <td className="text-xs max-w-[160px] truncate">{[p.bill_to_address_line1, p.bill_to_city].filter(Boolean).join(', ') || '-'}</td>
                        <td className="text-xs max-w-[160px] truncate">{def ? `${def.ship_to_name || ''} - ${def.city || ''}` : '-'}</td>
                        <td className="text-xs">{p.phone || p.email || '-'}</td>
                        <td><span className={`badge ${statusBadge(p.vendor_status || (p.active ? 'Active' : 'On Hold'))}`}>{p.vendor_status || (p.active ? 'Active' : 'On Hold')}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button onClick={() => openView(p)} className="text-navy-400 hover:text-navy text-xs">View</button>
                            <button onClick={() => openEdit(p)} className="text-navy-400 hover:text-navy"><Pencil size={14} /></button>
                            <button onClick={() => setToDelete(p)} className="text-navy-400 hover:text-brick"><Trash2 size={14} /></button>
                          </div>
                        </td>
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

      {modalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
          <div className="card bg-white flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden !p-0">
            {/* Title bar */}
            <div className="flex items-center justify-between bg-navy px-5 py-3">
              <h3 className="text-sm font-semibold tracking-wide text-white">
                Vendor Master Data <span className="font-normal text-white/60">- {viewOnly ? 'View' : editing ? 'Edit' : 'New'}</span>
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Header block (always visible) */}
              <div className="grid gap-x-10 gap-y-2.5 p-5 md:grid-cols-2">
                <div className="space-y-2.5">
                  <Row label="Vendor Code">
                    <input disabled className="input bg-navy-50 font-semibold" value={form.vendor_code || ''} placeholder="Automatic (V0001...)" />
                  </Row>
                  <Row label="Name *" error={errors.name}>
                    <input disabled={viewOnly} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Row>
                  <Row label="Short Name">
                    <input disabled={viewOnly} className="input" value={form.short_name || ''} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
                  </Row>
                  <Row label="Vendor Group">
                    <input disabled={viewOnly} className="input" list="vendor-groups" placeholder="e.g. Raw Material, Transport" value={form.vendor_group || ''} onChange={(e) => setForm({ ...form, vendor_group: e.target.value })} />
                    <datalist id="vendor-groups">{vendorGroups.map((g) => <option key={g} value={g} />)}</datalist>
                  </Row>
                  <Row label="Company">
                    <select disabled={viewOnly} className="input" value={form.company_location_id || ''} onChange={(e) => setForm({ ...form, company_location_id: e.target.value || null })}>
                      <option value="">All Companies</option>
                      {locations.map((l) => <option key={l.id} value={l.id}>{locationName(l)}</option>)}
                    </select>
                  </Row>
                </div>

                <div className="space-y-2.5">
                  <Row label="GSTIN" error={errors.gstin || (!viewOnly && gstinStatus(form.gstin) === 'invalid' ? 'This GSTIN looks wrong - please re-check it' : '')}>
                    <input disabled={viewOnly} className="input" maxLength={15} placeholder="15-character GSTIN" value={form.gstin || ''} onChange={(e) => handleGstinChange(e.target.value)} />
                    {!viewOnly && (
                      <button type="button" onClick={openGstPortal} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-navy-500 hover:text-navy">
                        <ExternalLink size={12} /> Verify on GST portal (copies GSTIN)
                      </button>
                    )}
                  </Row>
                  <Row label="PAN" error={errors.pan}>
                    <input disabled={viewOnly} className="input" value={form.pan || ''} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
                  </Row>
                  <Row label="Status">
                    <select disabled={viewOnly} className="input" value={form.vendor_status || 'Active'} onChange={(e) => setForm({ ...form, vendor_status: e.target.value })}>
                      {VENDOR_STATUSES.map((st) => <option key={st}>{st}</option>)}
                    </select>
                  </Row>
                  <Row label="Rating">
                    <select disabled={viewOnly} className="input" value={form.rating ?? ''} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
                      <option value="">Not rated</option>
                      {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{'\u2605'.repeat(n)}{'\u2606'.repeat(5 - n)}  ({n}/5)</option>)}
                    </select>
                  </Row>
                  {form.vendor_status && form.vendor_status !== 'Active' && (
                    <p className="rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 text-xs text-gold-700">
                      This vendor will show as {form.vendor_status} in the Vendor Master list until it is set back to Active.
                    </p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-navy-100 px-5">
                <div className="flex flex-wrap gap-1">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`-mb-px rounded-t-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                        tab === t.id
                          ? 'border-navy-100 border-b-white bg-white text-navy'
                          : 'border-transparent text-navy-400 hover:text-navy'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab content */}
              <div className="p-5">
                {tab === 'general' && (
                  <div className="grid min-h-[200px] content-start gap-x-10 gap-y-2.5 md:grid-cols-2">
                    <Row label="Contact Person"><input disabled={viewOnly} className="input" value={form.contact_person || ''} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} /></Row>
                    <Row label="GST Type">
                      <select disabled={viewOnly} className="input" value={form.gst_type || 'Regular'} onChange={(e) => setForm({ ...form, gst_type: e.target.value })}>
                        {GST_TYPES.map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </Row>
                    <Row label="Phone"><input disabled={viewOnly} className="input" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Row>
                    <Row label="MSME / Udyam No."><input disabled={viewOnly} className="input" placeholder="UDYAM-XX-00-0000000" value={form.msme_number || ''} onChange={(e) => setForm({ ...form, msme_number: e.target.value.toUpperCase() })} /></Row>
                    <Row label="Email"><input disabled={viewOnly} className="input" type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Row>
                  </div>
                )}

                {tab === 'addresses' && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-gold-600 mb-2">Bill To Address</h4>
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <Field label="Address Line 1" full><input disabled={viewOnly} className="input" value={form.bill_to_address_line1 || ''} onChange={(e) => setForm({ ...form, bill_to_address_line1: e.target.value })} /></Field>
                      <Field label="Address Line 2" full><input disabled={viewOnly} className="input" value={form.bill_to_address_line2 || ''} onChange={(e) => setForm({ ...form, bill_to_address_line2: e.target.value })} /></Field>
                      <Field label="City"><input disabled={viewOnly} className="input" value={form.bill_to_city || ''} onChange={(e) => setForm({ ...form, bill_to_city: e.target.value })} /></Field>
                      <Field label="District"><input disabled={viewOnly} className="input" value={form.bill_to_district || ''} onChange={(e) => setForm({ ...form, bill_to_district: e.target.value })} /></Field>
                      <Field label="State">
                        <select disabled={viewOnly} className="input" value={form.bill_to_state || ''} onChange={(e) => setForm({ ...form, bill_to_state: e.target.value })}>
                          <option value="">Select state</option>
                          {INDIAN_STATES.map((st) => <option key={st.code} value={st.name}>{st.name}</option>)}
                        </select>
                      </Field>
                      <Field label="State Code"><input disabled={viewOnly} className="input" value={form.bill_to_state_code || ''} onChange={(e) => setForm({ ...form, bill_to_state_code: e.target.value })} /></Field>
                      <Field label="PIN Code" error={errors.bill_to_pin}><input disabled={viewOnly} className="input" value={form.bill_to_pin || ''} onChange={(e) => setForm({ ...form, bill_to_pin: e.target.value })} /></Field>
                    </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase text-gold-600">Ship To Addresses</h4>
              {!viewOnly && <button type="button" className="btn-outline py-1" onClick={addShipTo}><Plus size={14} /> Add Ship To Address</button>}
            </div>
            <div className="space-y-3 mb-2">
              {shipToList.length === 0 && <p className="text-xs text-navy-400">No additional Ship To addresses. Bill To will be used by default.</p>}
              {shipToList.map((s, idx) => (
                <div key={idx} className="border border-navy-100 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center gap-2 text-xs text-navy-500 cursor-pointer">
                      <input disabled={viewOnly} type="checkbox" checked={Boolean(s.is_default)} onChange={(e) => updateShipTo(idx, { is_default: e.target.checked })} />
                      <Star size={12} className={s.is_default ? 'text-gold-500 fill-gold-500' : 'text-navy-300'} /> Default Ship To
                    </label>
                    {!viewOnly && <button type="button" onClick={() => removeShipTo(idx)} className="text-brick hover:text-brick-600"><Trash2 size={14} /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input disabled={viewOnly} className="input col-span-2" placeholder="Ship To Name" value={s.ship_to_name} onChange={(e) => updateShipTo(idx, { ship_to_name: e.target.value })} />
                    <input disabled={viewOnly} className="input col-span-2" placeholder="Address Line 1" value={s.address_line1} onChange={(e) => updateShipTo(idx, { address_line1: e.target.value })} />
                    <input disabled={viewOnly} className="input col-span-2" placeholder="Address Line 2" value={s.address_line2} onChange={(e) => updateShipTo(idx, { address_line2: e.target.value })} />
                    <input disabled={viewOnly} className="input" placeholder="City" value={s.city} onChange={(e) => updateShipTo(idx, { city: e.target.value })} />
                    <input disabled={viewOnly} className="input" placeholder="District" value={s.district} onChange={(e) => updateShipTo(idx, { district: e.target.value })} />
                    <select disabled={viewOnly} className="input" value={s.state} onChange={(e) => updateShipTo(idx, { state: e.target.value })}>
                      <option value="">State</option>
                      {INDIAN_STATES.map((st) => <option key={st.code} value={st.name}>{st.name}</option>)}
                    </select>
                    <input disabled={viewOnly} className="input" placeholder="State Code" value={s.state_code} onChange={(e) => updateShipTo(idx, { state_code: e.target.value })} />
                    <input disabled={viewOnly} className="input" placeholder="PIN Code" value={s.pin_code} onChange={(e) => updateShipTo(idx, { pin_code: e.target.value })} />
                    <input disabled={viewOnly} className="input" placeholder="GSTIN" value={s.gstin} onChange={(e) => updateShipTo(idx, { gstin: e.target.value.toUpperCase() })} />
                  </div>
                </div>
              ))}
            </div>

                  </div>
                )}

                {tab === 'payment' && (
                  <div className="grid min-h-[200px] content-start gap-x-10 gap-y-2.5 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-semibold uppercase text-gold-600">Payment &amp; Credit</h4>
                      <Row label="Payment Terms">
                        <select disabled={viewOnly} className="input" value={form.payment_terms || ''} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}>
                          <option value="">Select</option>
                          {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
                          {form.payment_terms && !PAYMENT_TERMS.includes(form.payment_terms) && <option>{form.payment_terms}</option>}
                        </select>
                      </Row>
                      <Row label="Credit Days" error={errors.credit_days}>
                        <input disabled={viewOnly} type="number" min="0" step="1" className="input" value={form.credit_days ?? ''} onChange={(e) => setForm({ ...form, credit_days: e.target.value })} />
                      </Row>
                      <Row label="Credit Limit" error={errors.credit_limit}>
                        <input disabled={viewOnly} type="number" min="0" step="0.01" className="input" placeholder="Rs." value={form.credit_limit ?? ''} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                      </Row>
                    </div>
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-semibold uppercase text-gold-600">TDS</h4>
                      <Row label="TDS Section">
                        <select disabled={viewOnly} className="input" value={form.tds_section || ''} onChange={(e) => {
                          const sec = e.target.value
                          const sug = suggestTds(sec, form.gstin, form.pan)
                          if (sug && sug.rate !== null) { setForm({ ...form, tds_section: sec, tds_rate: sug.rate }); setTdsAuto(true) }
                          else { setForm({ ...form, tds_section: sec, tds_rate: sec ? form.tds_rate : '' }); setTdsAuto(false) }
                        }}>
                          <option value="">Not applicable</option>
                          {TDS_SECTIONS.map(([c, d]) => <option key={c} value={c}>{c} - {d}</option>)}
                        </select>
                      </Row>
                      <Row label="TDS Rate %" error={errors.tds_rate}>
                        <input disabled={viewOnly} type="number" min="0" max="100" step="0.01" className="input" value={form.tds_rate ?? ''} onChange={(e) => { setForm({ ...form, tds_rate: e.target.value }); setTdsAuto(false) }} />
                      </Row>
                      {tdsHint?.note && !viewOnly && (
                        <p className="ml-[142px] text-[11px] text-navy-400">{tdsAuto ? 'Auto-filled: ' : 'Suggested: '}{tdsHint.note}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-navy-100 bg-white px-5 py-3">
              <button className="btn-outline" onClick={() => setModalOpen(false)}>{viewOnly ? 'Close' : 'Cancel'}</button>
              {!viewOnly && (
                <button className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this record?"
        message={`"${toDelete?.name}" and its Ship To addresses will be permanently removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}

function Field({ label, children, error, full, hint }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="text-[11px] text-navy-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-brick mt-1">{error}</p>}
    </div>
  )
}

function Row({ label, children, error }) {
  return (
    <div>
      <div className="grid grid-cols-[130px_1fr] items-center gap-3">
        <label className="text-xs font-semibold text-navy-500">{label}</label>
        <div>{children}</div>
      </div>
      {error && <p className="ml-[142px] mt-1 text-xs text-brick">{error}</p>}
    </div>
  )
}
