import { supabase } from './supabase'
import { getCompany } from './companyProfile'

// Company locations (branches / warehouses / plants).
// A Delivery Challan is dispatched FROM one location. The location's details
// are copied into the challan (dispatch_from_snapshot) so old challans never
// change when a location is edited later.

const TABLE = 'company_locations'

export async function listLocations() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('is_default', { ascending: false })
    .order('location_name')
  if (error) throw error
  return data || []
}

const txt = (v) => (v ?? '').toString().trim() || null

// values: { id?, location_name, address, city, state, state_code, pincode, gstin, phone, email, is_default, active }
export async function saveLocation(values, userId) {
  const isDefault = Boolean(values.is_default)
  const row = {
    location_name: txt(values.location_name),
    legal_name: txt(values.legal_name),
    pan: txt(values.pan)?.toUpperCase() || null,
    logo_url: txt(values.logo_url),
    address: txt(values.address),
    city: txt(values.city),
    state: txt(values.state),
    state_code: txt(values.state_code),
    pincode: txt(values.pincode),
    gstin: txt(values.gstin)?.toUpperCase() || null,
    phone: txt(values.phone),
    email: txt(values.email),
    is_default: isDefault,
    active: isDefault ? true : values.active !== false
  }

  if (isDefault) {
    let clear = supabase.from(TABLE).update({ is_default: false }).eq('is_default', true)
    if (values.id) clear = clear.neq('id', values.id)
    const { error: clearErr } = await clear
    if (clearErr) throw clearErr
  }

  if (values.id) {
    const { error } = await supabase.from(TABLE).update(row).eq('id', values.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from(TABLE).insert({ ...row, created_by: userId || null })
    if (error) throw error
  }
}

export async function deleteLocation(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

/**
 * Builds the "dispatch from" snapshot stored on a challan.
 * Pass a location row, or null for the Head Office (company profile).
 * Anything a location leaves blank (GSTIN, phone, email) falls back to the company.
 */
export function buildDispatchFrom(location) {
  const c = getCompany()
  if (!location) {
    return {
      location_id: null,
      location_name: 'Head Office',
      company_name: c.name || '',
      pan: '',
      logo: '', // empty = follow the company profile logo
      address: c.address || '',
      city: c.city || '',
      state: c.state || '',
      state_code: String(c.stateCode || ''),
      pincode: c.pincode || '',
      gstin: c.gstin || '',
      phone: c.phone || '',
      email: c.email || ''
    }
  }
  return {
    location_id: location.id,
    location_name: location.location_name || '',
    company_name: location.legal_name || c.name || '',
    pan: location.pan || '',
    logo: location.logo_url || '',
    address: location.address || '',
    city: location.city || '',
    state: location.state || '',
    state_code: String(location.state_code || ''),
    pincode: location.pincode || '',
    gstin: location.gstin || c.gstin || '',
    phone: location.phone || c.phone || '',
    email: location.email || c.email || ''
  }
}

const hasSnapshot = (s) => Boolean(s && (s.address || s.pincode || s.gstin || s.location_id))

// PAN = characters 3-12 of a GSTIN
const panFromGstin = (g) => (String(g || '').length >= 12 ? String(g).slice(2, 12).toUpperCase() : '')

/**
 * Company details for one challan: the company profile (name, logo, PAN)
 * with the address / state / pincode / GSTIN of the chosen dispatch location
 * laid over it. Challans without a snapshot (created before locations
 * existed) just use the company profile.
 */
export function applyDispatchFrom(company, snapshot) {
  if (!hasSnapshot(snapshot)) return { ...company }
  const gstin = snapshot.gstin || company.gstin
  // A location with its own GSTIN (another company / registration) gets the PAN inside that GSTIN
  const ownGstin = gstin && gstin !== company.gstin
  return {
    ...company,
    name: snapshot.company_name || company.name,
    pan: snapshot.pan || (ownGstin ? panFromGstin(gstin) : company.pan),
    logo: snapshot.logo || company.logo,
    address: snapshot.address || company.address,
    city: snapshot.city || '',
    state: snapshot.state || company.state,
    stateCode: snapshot.state_code || company.stateCode,
    pincode: snapshot.pincode || company.pincode,
    gstin,
    phone: snapshot.phone || company.phone,
    email: snapshot.email || company.email
  }
}
