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

// Extra Item Master columns. They are only read from an Excel file when the file has that
// column, so importing an older file never wipes values already saved.
const EXTRA_COLUMNS = [
  { header: 'Foreign Name', key: 'foreign_name', type: 'text' },
  { header: 'Item Type', key: 'item_type', type: 'text', fallback: 'Item' },
  { header: 'Bar Code', key: 'barcode', type: 'text' },
  { header: 'Inventory Item', key: 'is_inventory_item', type: 'bool' },
  { header: 'Sales Item', key: 'is_sales_item', type: 'bool' },
  { header: 'Purchase Item', key: 'is_purchase_item', type: 'bool' },
  { header: 'Purchase Price', key: 'purchase_price', type: 'num' },
  { header: 'Preferred Vendor', key: 'preferred_vendor', type: 'text' },
  { header: 'Lead Time (days)', key: 'lead_time_days', type: 'intnull' },
  { header: 'MRP', key: 'mrp', type: 'num' },
  { header: 'Discount %', key: 'discount_percent', type: 'num' },
  { header: 'Minimum Stock', key: 'min_stock', type: 'num' },
  { header: 'Maximum Stock', key: 'max_stock', type: 'num' },
  { header: 'Valuation Method', key: 'valuation_method', type: 'text', fallback: 'Weighted Average' },
  { header: 'Item Cost', key: 'item_cost', type: 'num' },
  { header: 'Weight', key: 'weight', type: 'numnull' },
  { header: 'Storage Location', key: 'storage_location', type: 'text' },
  { header: 'Remarks', key: 'remarks', type: 'text' }
]

function convertCell(spec, raw) {
  const empty = raw === '' || raw === null || raw === undefined
  switch (spec.type) {
    case 'bool':
      return ['yes', 'true', 'y', '1'].includes(String(raw).trim().toLowerCase())
    case 'num':
      return Number(raw) || 0
    case 'numnull':
      return empty ? null : Number(raw)
    case 'intnull':
      return empty ? null : Math.round(Number(raw))
    default: {
      const t = String(raw ?? '').trim()
      return t || (spec.fallback !== undefined ? spec.fallback : null)
    }
  }
}

export async function bulkImportItems(rows) {
  // Expects rows shaped like the exported Excel columns; maps loosely.
  // Only touch Category / Brand / Price-includes-GST when the file actually has those columns,
  // so importing an older file never wipes values already saved.
  const hasCategory = rows.some((r) => 'Category' in r)
  const hasBrand = rows.some((r) => 'Brand' in r)
  const hasTaxIncl = rows.some((r) => 'Price Includes GST' in r)
  const extraSpecs = EXTRA_COLUMNS.filter((spec) => rows.some((r) => spec.header in r))

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
      active: String(r['Status'] || 'Active').toLowerCase() !== 'inactive',
      ...(hasCategory ? { category: String(r['Category'] || '').trim() || null } : {}),
      ...(hasBrand ? { brand: String(r['Brand'] || '').trim() || null } : {}),
      ...(hasTaxIncl ? { tax_inclusive: ['yes', 'true', 'y', '1'].includes(String(r['Price Includes GST']).trim().toLowerCase()) } : {}),
      ...Object.fromEntries(extraSpecs.map((spec) => [spec.key, convertCell(spec, r[spec.header])]))
    }))

  if (!payload.length) return { imported: 0 }

  const { error } = await supabase.from('items').upsert(payload, { onConflict: 'item_code' })
  if (error) throw error
  return { imported: payload.length }
}
