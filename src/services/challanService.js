import { supabase } from '../lib/supabase'
import { getNextDcNumber } from './numberingService'

const CHALLAN_SELECT = `
  *,
  partners ( id, name, partner_type, gstin ),
  delivery_challan_items ( * ),
  eway_bills ( * )
`

export async function listChallans(filters = {}) {
  let query = supabase.from('delivery_challans').select(CHALLAN_SELECT).order('created_at', { ascending: false })

  if (filters.dateFrom) query = query.gte('dc_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('dc_date', filters.dateTo)
  if (filters.partnerId) query = query.eq('partner_id', filters.partnerId)
  if (filters.dcNumber) query = query.ilike('dc_number', `%${filters.dcNumber}%`)
  if (filters.vehicleNumber) query = query.ilike('vehicle_number', `%${filters.vehicleNumber}%`)
  if (filters.locationId === '__head') query = query.is('location_id', null)
  else if (filters.locationId) query = query.eq('location_id', filters.locationId)
  if (filters.status && filters.status !== 'All') query = query.eq('dc_status', filters.status)

  const { data, error } = await query
  if (error) throw error

  let rows = data || []

  // Client-side filters for fields that live in JSONB snapshots or joined tables
  if (filters.search) {
    const s = filters.search.toLowerCase()
    rows = rows.filter(
      (r) =>
        r.dc_number?.toLowerCase().includes(s) ||
        r.partners?.name?.toLowerCase().includes(s) ||
        r.bill_to_snapshot?.name?.toLowerCase().includes(s) ||
        r.bill_to_snapshot?.gstin?.toLowerCase().includes(s)
    )
  }
  if (filters.gstin) {
    rows = rows.filter((r) => r.bill_to_snapshot?.gstin?.toLowerCase().includes(filters.gstin.toLowerCase()))
  }
  if (filters.state) {
    rows = rows.filter(
      (r) =>
        r.bill_to_snapshot?.state?.toLowerCase() === filters.state.toLowerCase() ||
        r.ship_to_snapshot?.state?.toLowerCase() === filters.state.toLowerCase()
    )
  }
  if (filters.ewayBillNumber) {
    rows = rows.filter((r) =>
      r.eway_bills?.some((e) => e.eway_bill_number?.toLowerCase().includes(filters.ewayBillNumber.toLowerCase()))
    )
  }

  return rows
}

export async function getChallan(id) {
  const { data, error } = await supabase.from('delivery_challans').select(CHALLAN_SELECT).eq('id', id).single()
  if (error) throw error
  return data
}

/**
 * Creates a Delivery Challan + its item rows (+ optional E-Way Bill row)
 * in a best-effort transaction-like sequence. Reserves the DC number
 * atomically via the database function so concurrent creates never clash.
 */
export async function createChallan({ header, items, eway, autoNumber = true }) {
  const dcNumber = autoNumber ? await getNextDcNumber(new Date(header.dc_date || Date.now())) : header.dc_number

  const { data: challan, error } = await supabase
    .from('delivery_challans')
    .insert({ ...header, dc_number: dcNumber })
    .select()
    .single()
  if (error) throw error

  if (items?.length) {
    const rows = items.map((it, idx) => ({ ...stripClientFields(it), delivery_challan_id: challan.id, sl_no: idx + 1 }))
    const { error: itemErr } = await supabase.from('delivery_challan_items').insert(rows)
    if (itemErr) {
      // best-effort rollback of the header row so we don't leave an orphan DC number
      await supabase.from('delivery_challans').delete().eq('id', challan.id)
      throw itemErr
    }
  }

  if (eway?.generate) {
    const { error: ewayErr } = await supabase.from('eway_bills').insert({
      delivery_challan_id: challan.id,
      eway_bill_number: eway.eway_bill_number || null,
      eway_bill_date: eway.eway_bill_date || null,
      valid_until: eway.valid_until || null,
      transporter_id: eway.transporter_id || null,
      transporter_name: eway.transporter_name || header.transporter_name || null,
      vehicle_number: eway.vehicle_number || header.vehicle_number || null,
      vehicle_type: eway.vehicle_type || null,
      transport_mode: eway.transport_mode || header.transport_mode || null,
      distance_km: eway.distance_km || null,
      status: eway.status || 'Pending'
    })
    if (ewayErr) throw ewayErr
  }

  return getChallan(challan.id)
}

export async function updateChallan(id, { header, items, eway }) {
  const { error } = await supabase.from('delivery_challans').update(header).eq('id', id)
  if (error) throw error

  if (items) {
    const { error: delErr } = await supabase.from('delivery_challan_items').delete().eq('delivery_challan_id', id)
    if (delErr) throw delErr
    if (items.length) {
      const rows = items.map((it, idx) => ({ ...stripClientFields(it), delivery_challan_id: id, sl_no: idx + 1 }))
      const { error: insErr } = await supabase.from('delivery_challan_items').insert(rows)
      if (insErr) throw insErr
    }
  }

  if (eway) {
    if (eway.generate) {
      const { error: ewayErr } = await supabase.from('eway_bills').upsert(
        {
          delivery_challan_id: id,
          eway_bill_number: eway.eway_bill_number || null,
          eway_bill_date: eway.eway_bill_date || null,
          valid_until: eway.valid_until || null,
          transporter_id: eway.transporter_id || null,
          transporter_name: eway.transporter_name || null,
          vehicle_number: eway.vehicle_number || null,
          vehicle_type: eway.vehicle_type || null,
          transport_mode: eway.transport_mode || null,
          distance_km: eway.distance_km || null,
          status: eway.status || 'Pending'
        },
        { onConflict: 'delivery_challan_id' }
      )
      if (ewayErr) throw ewayErr
    }
  }

  return getChallan(id)
}

export async function updateChallanStatus(id, dc_status) {
  const { error } = await supabase.from('delivery_challans').update({ dc_status }).eq('id', id)
  if (error) throw error
}

export async function deleteChallan(id) {
  const { error } = await supabase.from('delivery_challans').delete().eq('id', id)
  if (error) throw error
}

export async function getDashboardStats() {
  const { data, error } = await supabase
    .from('delivery_challans')
    .select('id, dc_date, dc_status, grand_total, created_at, eway_bills(status)')
  if (error) throw error

  const rows = data || []
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const monthStr = todayStr.slice(0, 7)

  const stats = {
    total: rows.length,
    today: rows.filter((r) => r.dc_date === todayStr).length,
    thisMonth: rows.filter((r) => r.dc_date?.slice(0, 7) === monthStr).length,
    ewayGenerated: rows.filter((r) => r.eway_bills?.some((e) => e.status === 'Generated')).length,
    ewayPending: rows.filter((r) => r.eway_bills?.some((e) => e.status === 'Pending')).length,
    cancelled: rows.filter((r) => r.dc_status === 'Cancelled').length
  }
  return stats
}

function stripClientFields(row) {
  const { _clientId, ...rest } = row
  return rest
}
