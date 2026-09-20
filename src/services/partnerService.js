import { supabase } from '../lib/supabase'

// The partner objects loaded by listPartners/getPartner carry the nested
// `partner_ship_to` array. It is NOT a column of `partners`, so it must be
// removed before insert/update or Supabase rejects the request.
function cleanPartner(partner) {
  const { partner_ship_to, ...rest } = partner || {}
  return rest
}

export async function listPartners({ search = '', type = 'Vendor', activeOnly = false } = {}) {
  let query = supabase.from('partners').select('*, partner_ship_to(*)').order('name')

  if (type !== 'All') query = query.eq('partner_type', type)
  if (activeOnly) query = query.eq('active', true)
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,gstin.ilike.%${search}%,phone.ilike.%${search}%,short_name.ilike.%${search}%`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getPartner(id) {
  const { data, error } = await supabase.from('partners').select('*, partner_ship_to(*)').eq('id', id).single()
  if (error) throw error
  return data
}

export async function createPartner(partner, shipToList = []) {
  const { data, error } = await supabase.from('partners').insert(cleanPartner(partner)).select().single()
  if (error) throw error

  if (shipToList.length) {
    const rows = shipToList.map(({ id: _drop, created_at: _c, ...rest }) => ({ ...rest, partner_id: data.id }))
    const { error: shipErr } = await supabase.from('partner_ship_to').insert(rows)
    if (shipErr) throw shipErr
  }
  return data
}

export async function updatePartner(id, partner, shipToList) {
  const { error } = await supabase.from('partners').update(cleanPartner(partner)).eq('id', id)
  if (error) throw error

  if (shipToList) {
    // Simplest safe strategy: replace all ship-to rows for this partner
    const { error: delErr } = await supabase.from('partner_ship_to').delete().eq('partner_id', id)
    if (delErr) throw delErr
    if (shipToList.length) {
      const rows = shipToList.map(({ id: _drop, created_at: _c, ...rest }) => ({ ...rest, partner_id: id }))
      const { error: insErr } = await supabase.from('partner_ship_to').insert(rows)
      if (insErr) throw insErr
    }
  }
}

export async function deletePartner(id) {
  const { error } = await supabase.from('partners').delete().eq('id', id)
  if (error) throw error
}

export async function isDuplicateGSTIN(gstin, excludeId = null) {
  if (!gstin) return false
  let query = supabase.from('partners').select('id').eq('gstin', gstin)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).length > 0
}

/**
 * Bulk-imports vendors from an uploaded Excel/CSV file (see readExcelFile in
 * utils/excelExport.js). Expects rows shaped like the exported columns.
 * `locations` (from lib/locations.js -> listLocations()) is used to resolve
 * a "Company" column value (location/legal name, or "All Companies") to a
 * company_locations id. Rows are matched to an existing vendor by GSTIN
 * (updated in place); rows without a GSTIN are always inserted as new.
 */
export async function bulkImportPartners(rows, locations = []) {
  const locByName = new Map(
    locations.map((l) => [String(l.legal_name || l.location_name || '').trim().toLowerCase(), l.id])
  )

  const parsed = (rows || [])
    .filter((r) => String(r['Name'] || '').trim())
    .map((r) => {
      const companyName = String(r['Company'] || '').trim()
      const company_location_id =
        companyName && companyName.toLowerCase() !== 'all companies'
          ? locByName.get(companyName.toLowerCase()) || null
          : null
      const gstin = String(r['GSTIN'] || '').trim().toUpperCase()
      return {
        partner_type: 'Vendor',
        name: String(r['Name']).trim(),
        short_name: String(r['Short Name'] || '').trim(),
        gstin: gstin || null,
        pan: String(r['PAN'] || '').trim().toUpperCase(),
        contact_person: String(r['Contact Person'] || '').trim(),
        phone: String(r['Phone'] || '').trim(),
        email: String(r['Email'] || '').trim(),
        bill_to_address_line1: String(r['Address Line 1'] || r['Bill To Address'] || '').trim(),
        bill_to_address_line2: String(r['Address Line 2'] || '').trim(),
        bill_to_city: String(r['City'] || '').trim(),
        bill_to_district: String(r['District'] || '').trim(),
        bill_to_state: String(r['State'] || '').trim(),
        bill_to_state_code: String(r['State Code'] || '').trim(),
        bill_to_pin: String(r['PIN Code'] || '').trim(),
        company_location_id,
        active: String(r['Status'] || 'Active').toLowerCase() !== 'inactive'
      }
    })

  if (!parsed.length) return { imported: 0, updated: 0 }

  let created = 0
  let updated = 0

  for (const row of parsed) {
    let existingId = null
    if (row.gstin) {
      const { data: existing, error: findErr } = await supabase
        .from('partners')
        .select('id')
        .eq('gstin', row.gstin)
        .maybeSingle()
      if (findErr) throw findErr
      existingId = existing?.id || null
    }

    if (existingId) {
      const { error } = await supabase.from('partners').update(row).eq('id', existingId)
      if (error) throw error
      updated++
    } else {
      const { error } = await supabase.from('partners').insert(row)
      if (error) throw error
      created++
    }
  }

  return { imported: created, updated }
}
