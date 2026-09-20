import { COMPANY } from './constants'
import { supabase } from './supabase'

// Company details used on printed challans.
// Defaults come from .env (constants.js); anything an admin saves in
// Settings (table: company_settings) overrides them.

let override = {}

const FIELD_MAP = {
  name: 'name',
  address: 'address',
  gstin: 'gstin',
  pan: 'pan',
  state: 'state',
  state_code: 'stateCode',
  pincode: 'pincode',
  phone: 'phone',
  email: 'email',
  logo_url: 'logo'
}

function rowToCompany(row) {
  const out = {}
  if (!row) return out
  for (const [col, key] of Object.entries(FIELD_MAP)) {
    if (row[col] != null && String(row[col]).trim() !== '') out[key] = row[col]
  }
  return out
}

export function getCompany() {
  return { ...COMPANY, ...override }
}

export async function loadCompanyProfile() {
  const { data, error } = await supabase.from('company_settings').select('*').eq('id', 1).maybeSingle()
  if (!error) override = rowToCompany(data)
  return getCompany()
}

// values: { name, address, gstin, pan, state, stateCode, phone, email }
export async function saveCompanyProfile(values, userId) {
  const row = { id: 1, updated_at: new Date().toISOString(), updated_by: userId || null }
  for (const [col, key] of Object.entries(FIELD_MAP)) {
    if (key in values) row[col] = (values[key] ?? '').toString().trim() || null
  }
  const { error } = await supabase.from('company_settings').upsert(row, { onConflict: 'id' })
  if (error) throw error
  return loadCompanyProfile()
}

const LOGO_BUCKET = 'company-assets'

// Uploads a logo image to Supabase Storage and returns its public URL.
// Requires a public bucket named `company-assets` (see supabase/storage_setup.sql).
export async function uploadCompanyLogo(file) {
  if (!file) throw new Error('No file selected')
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file (PNG, JPG, SVG)')
  if (file.size > 2 * 1024 * 1024) throw new Error('Logo must be smaller than 2MB')

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `logo/company-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path)
  return data.publicUrl
}
