import * as XLSX from 'xlsx'

/**
 * Exports the Master List (Delivery Challans) to a formatted .xlsx file.
 * Each row is flattened per delivery-challan-item so every field in the
 * spec (item-level + header-level) is present.
 */
export function exportChallansToExcel(challans) {
  const rows = []

  challans.forEach((c) => {
    const billTo = c.bill_to_snapshot || {}
    const shipTo = c.ship_to_snapshot || {}
    const eway = c.eway_bills?.[0] || {}
    const items = c.delivery_challan_items?.length ? c.delivery_challan_items : [{}]

    items.forEach((it) => {
      rows.push({
        'DC Number': c.dc_number,
        'DC Date': c.dc_date,
        'Document Type': c.document_type,
        'Company': c.dispatch_from_snapshot?.company_name || c.dispatch_from_snapshot?.location_name || '',
        'Company GSTIN': c.dispatch_from_snapshot?.gstin || '',
        'Vendor': c.partners?.name || billTo.name || '',
        'GSTIN': billTo.gstin || '',
        'Bill To Address': [billTo.address_line1, billTo.address_line2, billTo.city].filter(Boolean).join(', '),
        'Bill To State': billTo.state || '',
        'Ship To Address': [shipTo.address_line1, shipTo.address_line2, shipTo.city].filter(Boolean).join(', '),
        'Ship To State': shipTo.state || '',
        'Item Code': it.item_code || '',
        'Item Name': it.item_name || '',
        'HSN': it.hsn || '',
        'Quantity': it.quantity ?? '',
        'UOM': it.uom || '',
        'Unit Price': it.unit_price ?? '',
        'Taxable Value': it.taxable_value ?? '',
        'CGST': it.cgst ?? '',
        'SGST': it.sgst ?? '',
        'IGST': it.igst ?? '',
        'Total': it.total_value ?? '',
        'Vehicle Number': c.vehicle_number || '',
        'Transporter': c.transporter_name || '',
        'E-Way Bill Number': eway.eway_bill_number || '',
        'E-Way Bill Date': eway.eway_bill_date || '',
        'E-Way Bill Status': eway.status || 'Not Generated',
        'DC Status': c.dc_status
      })
    })
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Reasonable column widths
  worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(Math.max(key.length + 2, 12), 40)
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Challans')

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `Delivery_Challan_Report_${dateStr}.xlsx`)
}

export function exportChallansToCSV(challans) {
  const rows = challans.map((c) => ({
    'DC Number': c.dc_number,
    'DC Date': c.dc_date,
    'Company': c.dispatch_from_snapshot?.company_name || c.dispatch_from_snapshot?.location_name || '',
    'Vendor': c.partners?.name || c.bill_to_snapshot?.name || '',
    'GSTIN': c.bill_to_snapshot?.gstin || '',
    'Grand Total': c.grand_total,
    'Vehicle Number': c.vehicle_number || '',
    'E-Way Bill Status': c.eway_bills?.[0]?.status || 'Not Generated',
    'DC Status': c.dc_status
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStr = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `Delivery_Challan_Report_${dateStr}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportItemsToExcel(items) {
  const rows = items.map((i) => ({
    'Item Code': i.item_code,
    'Item Name': i.item_name,
    'Description': i.description || '',
    'HSN/SAC': i.hsn || '',
    'UOM': i.uom || '',
    'GST %': i.gst_rate,
    'Unit Price': i.unit_price,
    'Opening Quantity': i.opening_quantity,
    'Current Quantity': i.current_quantity,
    'Reorder Level': i.reorder_level,
    'Status': i.active ? 'Active' : 'Inactive'
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Items')
  XLSX.writeFile(workbook, `Item_Master_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export function exportPartnersToExcel(partners, locationsById = {}) {
  const rows = partners.map((p) => ({
    'Name': p.name,
    'Short Name': p.short_name || '',
    'GSTIN': p.gstin || '',
    'PAN': p.pan || '',
    'Contact Person': p.contact_person || '',
    'Phone': p.phone || '',
    'Email': p.email || '',
    'Address Line 1': p.bill_to_address_line1 || '',
    'Address Line 2': p.bill_to_address_line2 || '',
    'City': p.bill_to_city || '',
    'District': p.bill_to_district || '',
    'State': p.bill_to_state || '',
    'State Code': p.bill_to_state_code || '',
    'PIN Code': p.bill_to_pin || '',
    'Company': p.company_location_id ? (locationsById[p.company_location_id] || '') : 'All Companies',
    'Status': p.active ? 'Active' : 'Inactive'
  }))
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendor Master')
  XLSX.writeFile(workbook, `Vendor_Master_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

/**
 * Reads an uploaded .xlsx file and returns an array of plain row objects.
 * Used by Item Master / Partner Master "Import Excel".
 */
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }))
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
