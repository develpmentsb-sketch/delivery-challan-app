import React, { useEffect, useRef, useState } from 'react'
import { Pencil, Save, X, Upload, Loader2 } from 'lucide-react'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { ROLE_LABELS } from '../lib/permissions'
import CompanyLocations from '../components/CompanyLocations'
import { getCompany, loadCompanyProfile, saveCompanyProfile, uploadCompanyLogo } from '../lib/companyProfile'

const FIELDS = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'address', label: 'Address', textarea: true },
  { key: 'gstin', label: 'GSTIN', placeholder: '29AANCM7396P1Z5' },
  { key: 'pan', label: 'PAN', placeholder: 'Leave blank to use the PAN inside the GSTIN' },
  { key: 'state', label: 'State' },
  { key: 'stateCode', label: 'State Code' },
  { key: 'pincode', label: 'Pincode', placeholder: '560001' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' }
]

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/

export default function Settings() {
  const { user, role, can } = useAuth()
  const toast = useToast()
  const canEdit = can('company.edit')

  const [company, setCompany] = useState(getCompany())
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(company)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    loadCompanyProfile().then((c) => { setCompany(c); setForm(c) })
  }, [])

  function startEdit() { setForm(company); setEditing(true) }
  function cancel() { setForm(company); setEditing(false) }

  async function save() {
    const gstin = (form.gstin || '').trim().toUpperCase()
    if (!(form.name || '').trim()) return toast.error('Company name is required')
    if (gstin && !GSTIN_RE.test(gstin)) return toast.error('GSTIN format looks wrong (15 characters, e.g. 29AANCM7396P1Z5)')
    setSaving(true)
    try {
      const updated = await saveCompanyProfile({ ...form, gstin }, user?.id)
      setCompany(updated)
      setForm(updated)
      setEditing(false)
      toast.success('Company profile updated')
    } catch (err) {
      toast.error(err.message || 'Failed to save company profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingLogo(true)
    try {
      const url = await uploadCompanyLogo(file)
      setForm((f) => ({ ...f, logo: url }))
      toast.success('Logo uploaded — click Save to apply it')
    } catch (err) {
      toast.error(err.message || 'Logo upload failed')
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <div>
      <Header title="Settings" subtitle="Company profile and account information" />

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-navy text-sm">Company Profile</h3>
            {canEdit && !editing && (
              <button className="btn-outline" onClick={startEdit}><Pencil size={14} /> Edit</button>
            )}
          </div>

          {!editing ? (
            <>
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-navy-50">
                <div className="w-20 h-20 rounded-md border border-navy-100 flex items-center justify-center overflow-hidden bg-cream-50 shrink-0">
                  {company.logo ? (
                    <img src={company.logo} alt="Company logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-navy-300 text-xs">No logo</span>
                  )}
                </div>
                <div className="text-xs text-navy-400">
                  This logo is printed on every Delivery Challan PDF.
                </div>
              </div>
              <dl className="space-y-2 text-sm">
                <Row k="Company Name" v={company.name} />
                <Row k="GSTIN" v={company.gstin} />
                <Row k="PAN" v={company.pan} />
                <Row k="Address" v={company.address} />
                <Row k="State" v={[company.state, company.stateCode && `(${company.stateCode})`].filter(Boolean).join(' ')} />
                <Row k="Pincode" v={company.pincode} />
                <Row k="Phone" v={company.phone} />
                <Row k="Email" v={company.email} />
              </dl>
              <p className="text-xs text-navy-400 mt-4">
                These details are printed in the header of every Delivery Challan.
                {canEdit ? '' : ' Only an Admin can change them.'}
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-navy-400 mb-1">Company Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-md border border-navy-100 flex items-center justify-center overflow-hidden bg-cream-50 shrink-0">
                    {form.logo ? (
                      <img src={form.logo} alt="Company logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-navy-300 text-xs">No logo</span>
                    )}
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <button
                      type="button"
                      className="btn-outline"
                      disabled={uploadingLogo}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                    </button>
                    <p className="text-xs text-navy-400 mt-1">PNG or JPG, up to 2MB. Square logos look best.</p>
                  </div>
                </div>
              </div>
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs text-navy-400 mb-1">{f.label}{f.required && ' *'}</label>
                  {f.textarea ? (
                    <textarea
                      className="input"
                      rows={3}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      className="input"
                      placeholder={f.placeholder}
                      value={form[f.key] || ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button className="btn-primary" onClick={save} disabled={saving}>
                  <Save size={16} /> {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn-outline" onClick={cancel} disabled={saving}><X size={16} /> Cancel</button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 self-start">
          <h3 className="font-semibold text-navy mb-4 text-sm">Account</h3>
          <dl className="space-y-2 text-sm">
            <Row k="Signed in as" v={user?.email} />
            <Row k="Role" v={role ? ROLE_LABELS[role] : '-'} />
            <Row k="User ID" v={user?.id} />
          </dl>
        </div>

        <CompanyLocations />
      </div>
    </div>
  )
}

function Row({ k, v }) {
  return (
    <div className="flex justify-between gap-4 border-b border-navy-50 pb-2">
      <dt className="text-navy-400 shrink-0">{k}</dt>
      <dd className="text-navy-800 font-medium text-right break-words">{v || '-'}</dd>
    </div>
  )
}
