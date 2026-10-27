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

// Ledger balance of each customer / vendor from the Accounting module (debit positive).
// Returns [] if the accounting tables are not installed yet.
export async function getPartnerBalances() {
  const { data, error } = await supabase.rpc('acc_partner_balances')
  if (error) return []
  return data || []
}

// Ledger statement of a customer / vendor: one block per company ledger, with every entry.
export async function getPartnerLedger(partnerId) {
  const { data: ledgers, error } = await supabase
    .from('acc_ledgers').select('id,name,company_id,opening_balance,opening_type').eq('partner_id', partnerId)
  if (error) throw error
  const out = []
  for (const l of ledgers || []) {
    const entries = []
    for (let from = 0; ; from += 1000) {
      const { data, error: e1 } = await supabase
        .from('acc_entries')
        .select('id,debit,credit,line_no,voucher_id, acc_vouchers!inner(voucher_date,voucher_type,voucher_no,narration)')
        .eq('ledger_id', l.id).order('id').range(from, from + 999)
      if (e1) throw e1
      entries.push(...data)
      if (data.length < 1000) break
    }
    // names of the other ledgers in each voucher, shown as "Particulars"
    const others = {}
    const ids = [...new Set(entries.map((e) => e.voucher_id))]
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error: e2 } = await supabase
        .from('acc_entries').select('voucher_id, acc_ledgers(name)').in('voucher_id', ids.slice(i, i + 150)).neq('ledger_id', l.id)
      if (e2) throw e2
      data.forEach((r) => { if (r.acc_ledgers?.name) (others[r.voucher_id] = others[r.voucher_id] || new Set()).add(r.acc_ledgers.name) })
    }
    out.push({
      ledger: l,
      entries: entries.map((e) => ({
        date: e.acc_vouchers.voucher_date, voucher: `${e.acc_vouchers.voucher_type} ${e.acc_vouchers.voucher_no}`,
        narration: e.acc_vouchers.narration || '', particulars: [...(others[e.voucher_id] || [])].join(', '),
        debit: Number(e.debit), credit: Number(e.credit), line: e.line_no, voucherId: e.voucher_id
      }))
    })
  }
  return out
}

export async function isDuplicateGSTIN(gstin, excludeId = null, type = 'Vendor') {
  if (!gstin) return false
  // Same GSTIN may be both a vendor and a customer, so only compare within the same type
  let query = supabase.from('partners').select('id').eq('gstin', gstin).eq('partner_type', type)
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
export async function bulkImportPartners(rows, locations = [], type = 'Vendor') {
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
        partner_type: type,
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
        .eq('partner_type', type)
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

// The entries posted by one voucher (every ledger it debits / credits), for the "what was posted" view.
export async function getVoucherEntries(voucherId) {
  const [v, e] = await Promise.all([
    supabase.from('acc_vouchers').select('voucher_type,voucher_no,voucher_date,narration,fy').eq('id', voucherId).single(),
    supabase.from('acc_entries').select('debit,credit,line_no,acc_ledgers(name)').eq('voucher_id', voucherId).order('line_no')
  ])
  if (v.error) throw v.error
  if (e.error) throw e.error
  return { voucher: v.data, lines: (e.data || []).map((x) => ({ ledger: x.acc_ledgers?.name || '', debit: Number(x.debit), credit: Number(x.credit) })) }
}
