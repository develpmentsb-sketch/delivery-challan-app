import * as XLSX from 'xlsx'

function challanRows(challans) {
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
  return rows
}

// Excel sheet names: max 31 chars, no \ / * ? : [ ], and must be unique per workbook.
function safeSheetName(name, used) {
  let base = String(name || 'Company').replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Company'
  let candidate = base
  let n = 2
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base.slice(0, 28)} ${n}`
    n++
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function companyTotals(list) {
  return list.reduce(
    (acc, r) => ({
      dcs: acc.dcs + 1,
      qty: acc.qty + Number(r.total_quantity || 0),
      taxable: acc.taxable + Number(r.taxable_value || 0),
      gst: acc.gst + Number(r.cgst || 0) + Number(r.sgst || 0) + Number(r.igst || 0),
      grandTotal: acc.grandTotal + Number(r.grand_total || 0)
    }),
    { dcs: 0, qty: 0, taxable: 0, gst: 0, grandTotal: 0 }
  )
}

function addChallanSheet(workbook, list, sheetName, usedNames) {
  const rows = challanRows(list)
  if (!rows.length) return null
  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = Object.keys(rows[0]).map((key) => ({
    wch: Math.min(Math.max(key.length + 2, 12), 40)
  }))
  const finalName = safeSheetName(sheetName, usedNames)
  XLSX.utils.book_append_sheet(workbook, worksheet, finalName)
  return finalName
}

/**
 * Exports the Master List (Delivery Challans) to a formatted .xlsx file.
 * Each row is flattened per delivery-challan-item so every field in the
 * spec (item-level + header-level) is present.
 *
 * With `splitByCompany: true`, a "Master List" index sheet is added first,
 * listing every company with its totals and a clickable link to that
 * company's own detail sheet (mirrors the on-screen Group by Company view).
 */
export function exportChallansToExcel(challans, { splitByCompany = false, fileName } = {}) {
  const workbook = XLSX.utils.book_new()
  const usedNames = new Set()

  if (splitByCompany) {
    const byCompany = new Map()
    challans.forEach((c) => {
      const key = c.dispatch_from_snapshot?.company_name || c.dispatch_from_snapshot?.location_name || 'Unassigned - Head Office'
      if (!byCompany.has(key)) byCompany.set(key, [])
      byCompany.get(key).push(c)
    })

    const summary = [...byCompany.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([company, list]) => {
        const sheetName = addChallanSheet(workbook, list, company, usedNames)
        return sheetName ? { company, sheetName, totals: companyTotals(list) } : null
      })
      .filter(Boolean)

    // Build the "Master List" index sheet: title, then one linked row per company
    const indexAoa = [
      ['Master List'],
      [],
      ['Company', 'DCs', 'Qty', 'Taxable Value', 'GST', 'Grand Total'],
      ...summary.map((s) => [s.company, s.totals.dcs, s.totals.qty, s.totals.taxable, s.totals.gst, s.totals.grandTotal])
    ]
    const indexSheet = XLSX.utils.aoa_to_sheet(indexAoa)
    indexSheet['!cols'] = [{ wch: 42 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 16 }]
    summary.forEach((s, i) => {
      const cellRef = XLSX.utils.encode_cell({ r: 3 + i, c: 0 })
      if (indexSheet[cellRef]) {
        indexSheet[cellRef].l = { Target: `#'${s.sheetName}'!A1`, Tooltip: `Go to ${s.company}` }
      }
    })
    XLSX.utils.book_append_sheet(workbook, indexSheet, 'Master List')
    // Move the index sheet to the front so it's the first tab shown
    workbook.SheetNames.unshift(workbook.SheetNames.pop())
  } else {
    addChallanSheet(workbook, challans, 'Delivery Challans', usedNames)
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, fileName || `Delivery_Challan_Report_${dateStr}.xlsx`)
}

/**
 * Master List Report - one row per Delivery Challan (not per item), in the
 * exact column layout supplied by the client:
 *   Sl No | Prepared By | From location | DC No | DC Date | DC Type |
 *   Purpose | Reference Name/Department: | Kind Attention: |
 *   No of Pacakage: Count | No of Pacakage: Weight | Sale value |
 *   Bill To | Ship To | Item Desciption 1 | Item UOM 1 | Item Qty 1 |
 *   Item Desciption 2 | Item UOM 2 | Item Qty 2 | ...
 *
 * The item-description/UOM/Qty triplet repeats as many times as the widest
 * challan in this export needs (so a 5-item DC gets 5 sets of columns, a
 * 2-item DC just leaves the extra ones blank).
 *
 * "Sale value" has no dedicated field in the app yet, so it is taken as the
 * challan's Grand Total (taxable value + GST). Swap the `saleValue` line
 * below to `it => it.taxable_value` if "before GST" is what's wanted instead.
 */
export function exportMasterListReport(challans, { fileName } = {}) {
  const maxItems = challans.reduce(
    (max, c) => Math.max(max, c.delivery_challan_items?.length || 0),
    1
  )

  const addressLine = (snap) =>
    [snap?.name, snap?.city, snap?.state].filter(Boolean).join(', ')

  const rows = challans.map((c, idx) => {
    const billTo = c.bill_to_snapshot || {}
    const shipTo = c.ship_to_snapshot || {}
    const items = c.delivery_challan_items || []
    const fromLocation =
      c.dispatch_from_snapshot?.location_name ||
      c.dispatch_from_snapshot?.company_name ||
      ''

    const row = {
      'Sl No': idx + 1,
      'Prepared By': c.prepared_by_name || '',
      'From location': fromLocation,
      'DC No': c.dc_number || '',
      'DC Date': c.dc_date || '',
      'DC Type': c.dc_type || '',
      'Purpose': c.purpose || '',
      'Reference Name/Department:': c.reference_name || '',
      'Kind Attention:': c.kind_attention || '',
      'No of Pacakage:\nCount': c.no_of_packages ?? '',
      'No of Pacakage:\nWeight': c.weight_kg ?? '',
      'Sale value': c.grand_total ?? '',
      'Bill To': addressLine(billTo) || (c.partners?.name ?? ''),
      'Ship To': addressLine(shipTo)
    }

    for (let i = 0; i < maxItems; i++) {
      const it = items[i] || {}
      const n = i + 1
      row[`Item  Desciption ${n}`] = it.item_name || it.description || ''
      row[`Item UOM ${n}`] = it.uom || ''
      row[`Item Qty ${n}`] = it.quantity ?? ''
    }

    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)
  worksheet['!cols'] = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(Math.max(key.replace('\n', ' ').length + 2, 10), 32)
  }))

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Master List')
  const dateStr = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(workbook, fileName || `Master_List_Report_${dateStr}.xlsx`)
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
