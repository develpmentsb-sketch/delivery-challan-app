import { supabase } from '../lib/supabase'

export async function listItems({ search = '', activeOnly = false } = {}) {
  let query = supabase.from('items').select('*').order('item_name')
  if (activeOnly) query = query.eq('active', true)
  if (search) {
    query = query.or(`item_name.ilike.%${search}%,item_code.ilike.%${search}%,hsn.ilike.%${search}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createItem(item) {
  const { data, error } = await supabase.from('items').insert(item).select().single()
  if (error) throw error
  return data
}

export async function updateItem(id, item) {
  const { error } = await supabase.from('items').update(item).eq('id', id)
  if (error) throw error
}

export async function deleteItem(id) {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

export async function isDuplicateItemCode(code, excludeId = null) {
  if (!code) return false
  let query = supabase.from('items').select('id').eq('item_code', code.trim().toUpperCase())
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) throw error
  return (data || []).length > 0
}

export async function bulkImportItems(rows) {
  // Expects rows shaped like the exported Excel columns; maps loosely.
  const payload = rows
    .filter((r) => r['Item Code'] && r['Item Name'])
    .map((r) => ({
      item_code: String(r['Item Code']).trim().toUpperCase(),
      item_name: String(r['Item Name']).trim(),
      description: r['Description'] || '',
      hsn: r['HSN/SAC'] || r['HSN'] || '',
      uom: r['UOM'] || 'NOS',
      gst_rate: Number(r['GST %']) || 0,
      unit_price: Number(r['Unit Price']) || 0,
      opening_quantity: Number(r['Opening Quantity']) || 0,
      current_quantity: Number(r['Current Quantity'] ?? r['Opening Quantity']) || 0,
      reorder_level: Number(r['Reorder Level']) || 0,
      active: String(r['Status'] || 'Active').toLowerCase() !== 'inactive'
    }))

  if (!payload.length) return { imported: 0 }

  const { error } = await supabase.from('items').upsert(payload, { onConflict: 'item_code' })
  if (error) throw error
  return { imported: payload.length }
}
