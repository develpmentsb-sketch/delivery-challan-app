import React, { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Save, X, MapPin, Star, Upload, Loader2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { getCompany, uploadCompanyLogo } from '../lib/companyProfile'
import { listLocations, saveLocation, deleteLocation } from '../lib/locations'
import { INDIAN_STATES, stateCodeFromName } from '../lib/constants'
import { isValidGSTIN, isValidPAN, isValidPin } from '../utils/validation'

const emptyForm = {
  id: null,
  location_name: '',
  legal_name: '',
  pan: '',
  logo_url: '',
  address: '',
  city: '',
  state: '',
  state_code: '',
  pincode: '',
  gstin: '',
  phone: '',
  email: '',
  is_default: false,
  active: true
}

export default function CompanyLocations() {
  const { user, can } = useAuth()
  const toast = useToast()
  const canEdit = can('company.edit')

  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(null) // null = form closed
  const [saving, setSaving] = useState(false)
  const [toDelete, setToDelete] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef(null)

  async function load() {
    try {
      setLocations(await listLocations())
      setLoadError('')
    } catch (err) {
      setLoadError(err.message || 'Could not load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const setF = (patch) => setForm((f) => ({ ...f, ...patch }))

  function pickState(name) {
    setF({ state: name, state_code: stateCodeFromName(name) })
  }

  async function submit() {
    const f = form
    const gstin = (f.gstin || '').trim().toUpperCase()
    const pan = (f.pan || '').trim().toUpperCase()
    if (!f.legal_name.trim()) return toast.error('Company name is required')
    if (pan && !isValidPAN(pan)) return toast.error('PAN format looks wrong (10 characters, e.g. AARCM8589N)')
    if (pan && gstin && gstin.slice(2, 12) !== pan) return toast.error('PAN does not match the PAN inside the GSTIN')
    if (!f.address.trim()) return toast.error('Address is required')
    if (!f.state) return toast.error('Select the state')
    if (!isValidPin(f.pincode) || !f.pincode.trim()) return toast.error('Enter a valid 6-digit pincode')
    if (gstin && !isValidGSTIN(gstin)) return toast.error('GSTIN format looks wrong (15 characters)')
    if (gstin && gstin.slice(0, 2) !== f.state_code) {
      return toast.error(`GSTIN starts with ${gstin.slice(0, 2)} but ${f.state} is state code ${f.state_code}`)
    }
    setSaving(true)
    try {
      await saveLocation({ ...f, gstin, pan, location_name: f.location_name.trim() || f.legal_name.trim() }, user?.id)
      toast.success(f.id ? 'Company updated' : 'Company added')
      setForm(null)
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to save location')
    } finally {
      setSaving(false)
    }
  }

  async function makeDefault(loc) {
    try {
      await saveLocation({ ...loc, is_default: true }, user?.id)
      toast.success(`${loc.legal_name || loc.location_name} is now the default company`)
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to set default')
    }
  }

  async function confirmDelete() {
    try {
      await deleteLocation(toDelete.id)
      toast.success(`${toDelete.legal_name || toDelete.location_name} deleted`)
      setToDelete(null)
      await load()
    } catch (err) {
      toast.error(err.message || 'Failed to delete location')
    }
  }

  async function handleLogo(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadCompanyLogo(file)
      setF({ logo_url: url })
    } catch (err) {
      toast.error(err.message || 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  const company = getCompany()
  const gstinBlank = form && !(form.gstin || '').trim()
  const differentState = form && form.state_code && company.stateCode && String(form.state_code) !== String(company.stateCode)

  return (
    <div className="card p-5 md:col-span-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-navy text-sm">Other Companies</h3>
        {canEdit && !form && (
          <button className="btn-outline" onClick={() => setForm({ ...emptyForm })}>
            <Plus size={14} /> Add Company
          </button>
        )}
      </div>
      <p className="text-xs text-navy-400 mb-4">
        Add another company (or a branch / warehouse). When you create a Delivery Challan you choose which
        company it is for; that company's name, logo, address, GSTIN and PAN are printed on the challan
        and used in the E-Way Bill JSON. The Company Profile on the left is the default company.
      </p>

      {loadError && (
        <p className="text-xs text-brick mb-3">
          {loadError}. If this is the first time, run <code>supabase/add_company_locations.sql</code> in the Supabase SQL editor.
        </p>
      )}

      {form && (
        <div className="rounded-md border border-navy-100 bg-cream-50 p-4 mb-4">
          <h4 className="text-sm font-semibold text-navy-800 mb-3">{form.id ? 'Edit company' : 'New company'}</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-navy-400 mb-1">Company name (printed on the DC) *</label>
              <input className="input" placeholder="e.g. Mecwin Green Propulsion Private Limited" value={form.legal_name} onChange={(e) => setF({ legal_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Short label (optional)</label>
              <input className="input" placeholder="e.g. Green Propulsion, Chennai Warehouse" value={form.location_name} onChange={(e) => setF({ location_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">GSTIN of this location</label>
              <input className="input" placeholder="Leave blank to use the company GSTIN" value={form.gstin} onChange={(e) => setF({ gstin: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">PAN</label>
              <input className="input" placeholder="Leave blank to use the PAN inside the GSTIN" value={form.pan} onChange={(e) => setF({ pan: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-md border border-navy-100 flex items-center justify-center overflow-hidden bg-cream-50 shrink-0">
                  {form.logo_url ? (
                    <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-navy-300 text-[10px]">Company logo</span>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                <button type="button" className="btn-outline" disabled={uploadingLogo} onClick={() => fileRef.current?.click()}>
                  {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploadingLogo ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-navy-400 mb-1">Address *</label>
              <textarea className="input" rows={2} value={form.address} onChange={(e) => setF({ address: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">City</label>
              <input className="input" value={form.city} onChange={(e) => setF({ city: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">State *</label>
              <select className="input" value={form.state} onChange={(e) => pickState(e.target.value)}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => <option key={s.code} value={s.name}>{s.name} ({s.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Pincode *</label>
              <input className="input" placeholder="600001" maxLength={6} value={form.pincode} onChange={(e) => setF({ pincode: e.target.value.replace(/\D/g, '') })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setF({ phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-navy-400 mb-1">Email</label>
              <input className="input" value={form.email} onChange={(e) => setF({ email: e.target.value })} />
            </div>
            <div className="flex items-end gap-5 pb-2">
              <label className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setF({ is_default: e.target.checked })} />
                Default location
              </label>
              <label className="flex items-center gap-2 text-sm text-navy-700 cursor-pointer">
                <input type="checkbox" checked={form.is_default || form.active} disabled={form.is_default} onChange={(e) => setF({ active: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          {gstinBlank && differentState && (
            <p className="text-xs text-gold-600 mt-3">
              This location is in a different state from the company profile ({company.state || 'not set'}). GST registration is
              state-wise, so it normally needs its own GSTIN for the E-Way Bill.
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <button className="btn-primary" onClick={submit} disabled={saving}>
              <Save size={16} /> {saving ? 'Saving...' : 'Save company'}
            </button>
            <button className="btn-outline" onClick={() => setForm(null)} disabled={saving}><X size={16} /> Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-navy-400">Loading locations...</p>
      ) : locations.length === 0 && !loadError ? (
        <p className="text-sm text-navy-400">
          No other companies yet. Challans are made for the company in the Company Profile.
        </p>
      ) : (
        <ul className="divide-y divide-navy-50">
          {locations.map((l) => (
            <li key={l.id} className="py-3 flex items-start gap-3">
              <MapPin size={16} className="text-navy-300 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0 text-sm">
                <p className="font-medium text-navy-800">
                  {l.legal_name || l.location_name}
                  {l.legal_name && l.location_name && l.location_name !== l.legal_name && (
                    <span className="text-xs text-navy-400 font-normal ml-2">({l.location_name})</span>
                  )}
                  {l.is_default && <span className="badge bg-gold-100 text-gold-600 ml-2">Default</span>}
                  {!l.active && <span className="badge bg-navy-50 text-navy-400 ml-2">Inactive</span>}
                </p>
                <p className="text-navy-500 break-words">
                  {[l.address, l.city, [l.state, l.pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', ')}
                </p>
                <p className="text-xs text-navy-400">
                  GSTIN: {l.gstin || `${company.gstin || '-'} (company)`}
                  {l.phone ? ` · ${l.phone}` : ''}
                </p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 shrink-0">
                  {!l.is_default && (
                    <button title="Make default" className="text-navy-300 hover:text-gold-600" onClick={() => makeDefault(l)}>
                      <Star size={15} />
                    </button>
                  )}
                  <button title="Edit" className="text-navy-300 hover:text-navy" onClick={() => setForm({ ...emptyForm, ...l, legal_name: l.legal_name || l.location_name || '', pan: l.pan || '', logo_url: l.logo_url || '', gstin: l.gstin || '', city: l.city || '', phone: l.phone || '', email: l.email || '', address: l.address || '', pincode: l.pincode || '', state: l.state || '', state_code: l.state_code || '' })}>
                    <Pencil size={15} />
                  </button>
                  <button title="Delete" className="text-navy-300 hover:text-brick" onClick={() => setToDelete(l)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!canEdit && <p className="text-xs text-navy-400 mt-3">Only an Admin can add or change locations.</p>}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this company?"
        message={`${toDelete?.legal_name || toDelete?.location_name} will be removed. Challans already created for it keep their printed details.`}
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
