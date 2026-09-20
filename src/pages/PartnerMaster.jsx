import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Search, Pencil, Trash2, FileSpreadsheet, Upload, X, Save, Loader2, Star } from 'lucide-react'
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

const PAGE_SIZE = 10
const ALL_COMPANIES = 'all'

const emptyPartner = () => ({
  partner_type: 'Vendor', name: '', short_name: '', gstin: '', pan: '', contact_person: '', phone: '', email: '',
  bill_to_address_line1: '', bill_to_address_line2: '', bill_to_city: '', bill_to_district: '',
  bill_to_state: '', bill_to_state_code: '', bill_to_pin: '', company_location_id: null, active: true
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
    if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.gstin?.toLowerCase().includes(q) || p.phone?.toLowerCase().includes(q) || p.bill_to_state?.toLowerCase().includes(q))
    return rows
  }, [partners, companyFilter, search])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openCreate() { setEditing(null); setForm(emptyPartner()); setShipToList([]); setErrors({}); setViewOnly(false); setModalOpen(true) }
  function openEdit(p) { setEditing(p); setForm(p); setShipToList(p.partner_ship_to || []); setErrors({}); setViewOnly(false); setModalOpen(true) }
  function openView(p) { setEditing(p); setForm(p); setShipToList(p.partner_ship_to || []); setErrors({}); setViewOnly(true); setModalOpen(true) }

  function addShipTo() { setShipToList((prev) => [...prev, emptyShipTo()]) }
  function updateShipTo(idx, patch) {
    setShipToList((prev) => prev.map((s, i) => {
      if (i !== idx) return patch.is_default ? { ...s, is_default: false } : s
      return { ...s, ...patch }
    }))
  }
  function removeShipTo(idx) { setShipToList((prev) => prev.filter((_, i) => i !== idx)) }

  async function handleSave() {
    const { valid, errors: errs } = validatePartner(form)
    if (!valid) { setErrors(errs); return }
    setSaving(true)
    try {
      if (form.gstin) {
        const dup = await isDuplicateGSTIN(form.gstin, editing?.id)
        if (dup) { setErrors({ gstin: 'This GSTIN is already used by another vendor' }); setSaving(false); return }
      }
      if (editing) {
        await updatePartner(editing.id, form, shipToList)
        toast.success('Vendor updated')
      } else {
        await createPartner(form, shipToList)
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
          <input className="input pl-8" placeholder="Search by Name, GSTIN, Phone, State..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
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
                    <th>Name</th><th>Company</th><th>GSTIN</th><th>State</th><th>Bill To</th><th>Default Ship To</th><th>Contact</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => {
                    const def = p.partner_ship_to?.find((s) => s.is_default) || p.partner_ship_to?.[0]
                    return (
                      <tr key={p.id}>
                        <td className="font-medium text-navy">{p.name}</td>
                        <td><span className={`badge ${p.company_location_id ? 'bg-navy-100 text-navy-600' : 'bg-forest-100 text-forest-600'}`}>{p.company_location_id ? (locationsById[p.company_location_id] || 'Unknown') : 'All Companies'}</span></td>
                        <td className="text-xs">{p.gstin || '-'}</td>
                        <td className="text-xs">{p.bill_to_state || '-'}</td>
                        <td className="text-xs max-w-[160px] truncate">{[p.bill_to_address_line1, p.bill_to_city].filter(Boolean).join(', ') || '-'}</td>
                        <td className="text-xs max-w-[160px] truncate">{def ? `${def.ship_to_name || ''} - ${def.city || ''}` : '-'}</td>
                        <td className="text-xs">{p.phone || p.email || '-'}</td>
                        <td><span className={`badge ${p.active ? 'bg-forest-100 text-forest-600' : 'bg-navy-100 text-navy-500'}`}>{p.active ? 'Active' : 'Inactive'}</span></td>
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
        <div className="fixed inset-0 z-[90] bg-navy-900/50 flex items-center justify-center p-4">
          <div className="card w-full max-w-3xl p-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-navy">{viewOnly ? 'View' : editing ? 'Edit' : 'Add'} Vendor</h3>
              <button onClick={() => setModalOpen(false)} className="text-navy-300 hover:text-navy-600"><X size={18} /></button>
            </div>

            <h4 className="text-xs font-semibold uppercase text-gold-600 mb-2">Basic Information</h4>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Field label="Name *" error={errors.name}>
                <input disabled={viewOnly} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Short Name">
                <input disabled={viewOnly} className="input" value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
              </Field>
              <Field label="Company" hint="Which company this vendor is allocated to. Leave as All Companies to make it available everywhere.">
                <select disabled={viewOnly} className="input" value={form.company_location_id || ''} onChange={(e) => setForm({ ...form, company_location_id: e.target.value || null })}>
                  <option value="">All Companies</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{locationName(l)}</option>)}
                </select>
              </Field>
              <Field label="GSTIN" error={errors.gstin}>
                <input disabled={viewOnly} className="input" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="PAN" error={errors.pan}>
                <input disabled={viewOnly} className="input" value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Contact Person">
                <input disabled={viewOnly} className="input" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} />
              </Field>
              <Field label="Phone">
                <input disabled={viewOnly} className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <input disabled={viewOnly} className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            </div>

            <h4 className="text-xs font-semibold uppercase text-gold-600 mb-2">Bill To Address</h4>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Field label="Address Line 1" full><input disabled={viewOnly} className="input" value={form.bill_to_address_line1} onChange={(e) => setForm({ ...form, bill_to_address_line1: e.target.value })} /></Field>
              <Field label="Address Line 2" full><input disabled={viewOnly} className="input" value={form.bill_to_address_line2} onChange={(e) => setForm({ ...form, bill_to_address_line2: e.target.value })} /></Field>
              <Field label="City"><input disabled={viewOnly} className="input" value={form.bill_to_city} onChange={(e) => setForm({ ...form, bill_to_city: e.target.value })} /></Field>
              <Field label="District"><input disabled={viewOnly} className="input" value={form.bill_to_district} onChange={(e) => setForm({ ...form, bill_to_district: e.target.value })} /></Field>
              <Field label="State">
                <select disabled={viewOnly} className="input" value={form.bill_to_state} onChange={(e) => setForm({ ...form, bill_to_state: e.target.value })}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="State Code"><input disabled={viewOnly} className="input" value={form.bill_to_state_code} onChange={(e) => setForm({ ...form, bill_to_state_code: e.target.value })} /></Field>
              <Field label="PIN Code" error={errors.bill_to_pin}><input disabled={viewOnly} className="input" value={form.bill_to_pin} onChange={(e) => setForm({ ...form, bill_to_pin: e.target.value })} /></Field>
              <Field label="Status">
                <label className="flex items-center gap-2 text-sm mt-2"><input disabled={viewOnly} type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
              </Field>
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

            {!viewOnly && (
              <div className="flex justify-end gap-2 mt-4">
                <button className="btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save
                </button>
              </div>
            )}
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
