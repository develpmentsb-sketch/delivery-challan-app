// Builds the bulk-upload JSON for the government E-Way Bill portal
// (Generate Bulk / "Upload JSON"), in exactly the format produced by the
// official "EWB Preparation Tool" Excel macro (version 1.0.0621).
//
// No other imports on purpose, so this file is easy to test on its own.

const JSON_VERSION = '1.0.0621'

// App unit -> government unit code (from the tool's "Master Codes" sheet)
const UNIT_CODES = {
  NOS: 'NOS', PCS: 'PCS', KG: 'KGS', GM: 'GMS', LTR: 'LTR', ML: 'MLT', MTR: 'MTR',
  BOX: 'BOX', BAG: 'BAG', SET: 'SET', PAIR: 'PRS', ROLL: 'ROL', SQM: 'SQM', DOZ: 'DOZ'
}

const TRANS_MODE_CODES = { road: 1, rail: 2, air: 3, ship: 4 }

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const clean = (v) =>
  String(v ?? '')
    .replace(/["\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const DOC_NO_REGEX = /^[A-Za-z0-9/-]{1,16}$/

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
function toPortalDate(v, label) {
  const m = String(v ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) throw new Error(`${label} is missing or invalid.`)
  return `${m[3]}/${m[2]}/${m[1]}`
}

function stateCode(v, label) {
  const n = parseInt(String(v ?? '').trim(), 10)
  if (!n) throw new Error(`${label} state code is missing.`)
  return n
}

function pincode(v, label) {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10)
  if (!n || n < 100000 || n > 999999) throw new Error(`${label} pincode is missing or invalid.`)
  return n
}

/**
 * Builds one bill object (one entry of "billLists").
 *
 * @param {object} p
 *   company   - { name, gstin, address, city?, state, stateCode, pincode }
 *   header    - challan header (dc_number, dc_date, document_type, ...)
 *   billTo    - { name, gstin, address_line1, address_line2, city, state, state_code, pin_code }
 *   shipTo    - same shape as billTo
 *   rows      - calculated item rows (item_name, description, hsn, uom, quantity, gst_rate, taxable_value, cgst, sgst, igst, total_value)
 *   totals    - { taxableValue, cgst, sgst, igst, grandTotal }
 *   eway      - { transport_mode, distance_km, transporter_id, transporter_name, vehicle_number, vehicle_type }
 */
export function buildEwayBill({ company, header, billTo, shipTo, rows, totals, eway }) {
  const gstin = clean(company?.gstin).toUpperCase()
  if (!gstin) throw new Error('Company GSTIN is missing. Set it in Settings.')
  if (!company?.address) throw new Error('Company address is missing. Set it in Settings.')
  if (!rows?.length) throw new Error('Add at least one item.')
  if (rows.length > 250) throw new Error('An e-way bill can have at most 250 items.')

  const docNo = clean(header.dc_number)
  if (!DOC_NO_REGEX.test(docNo)) {
    throw new Error(
      `Challan number "${docNo}" can't be used on the e-way bill portal. ` +
        'It must be 1 to 16 characters: letters, digits, "/" or "-" only.'
    )
  }

  const ship = shipTo && (shipTo.address_line1 || shipTo.pin_code) ? shipTo : billTo
  const docType = clean(header.document_type || 'Delivery Challan')
  const isJobWork = docType === 'Job Work'

  // Bill To and Ship To are different parties -> "Bill To-Ship To" (2), otherwise Regular (1)
  const shipGstin = clean(ship.gstin).toUpperCase()
  const billGstin = clean(billTo.gstin).toUpperCase()
  const transType = shipGstin && shipGstin !== billGstin ? 2 : 1

  const fromState = stateCode(company.stateCode, 'Company')
  const billState = stateCode(billTo.state_code, 'Bill To')
  const shipState = stateCode(ship.state_code || billTo.state_code, 'Ship To')

  const mode = String(eway?.transport_mode || header.transport_mode || 'Road').toLowerCase()
  const transMode = TRANS_MODE_CODES[mode.startsWith('ship') ? 'ship' : mode] || 1
  const isRoad = transMode === 1

  const vehicleNo = isRoad ? clean(eway?.vehicle_number || header.vehicle_number).toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
  const transporterId = clean(eway?.transporter_id).toUpperCase()
  if (isRoad && !vehicleNo && !transporterId) {
    throw new Error('Enter a Vehicle Number, or a Transporter ID if the vehicle is not known yet.')
  }

  const intra = !(round2(totals.igst) > 0)

  const itemList = rows.map((r, i) => {
    const hsn = String(r.hsn ?? '').replace(/\D/g, '')
    if (!hsn) throw new Error(`HSN code is missing for item ${i + 1}.`)
    if (!(Number(r.quantity) > 0)) throw new Error(`Quantity must be greater than 0 for item ${i + 1}.`)
    const rate = Number(r.gst_rate) || 0
    const name = clean(r.item_name || r.description || r.item_code)
    return {
      itemNo: i + 1,
      productName: name,
      productDesc: clean(r.description || r.item_name),
      hsnCode: hsn,
      quantity: Number(r.quantity),
      qtyUnit: UNIT_CODES[String(r.uom || 'NOS').toUpperCase()] || 'OTH',
      taxableAmount: round2(r.taxable_value),
      sgstRate: intra ? rate / 2 : 0,
      cgstRate: intra ? rate / 2 : 0,
      igstRate: intra ? 0 : rate,
      cessRate: 0,
      cessNonAdvol: 0
    }
  })

  // "Main HSN" = HSN of the highest-value line
  let mainRow = rows[0]
  rows.forEach((r) => {
    if ((Number(r.total_value) || 0) > (Number(mainRow.total_value) || 0)) mainRow = r
  })
  const mainHsnCode = parseInt(String(mainRow.hsn ?? '').replace(/\D/g, ''), 10) || 0

  const distance = Math.max(0, Math.round(Number(eway?.distance_km) || 0)) // 0 = portal works it out from the pincodes

  return {
    userGstin: gstin,
    supplyType: 'O',
    subSupplyType: isJobWork ? 4 : 8,
    subSupplyDesc: isJobWork ? '' : docType.slice(0, 20),
    docType: 'CHL',
    docNo,
    docDate: toPortalDate(header.dc_date, 'Challan date'),
    transType,

    fromGstin: gstin,
    fromTrdName: clean(company.name),
    fromAddr1: clean(company.address).slice(0, 120),
    fromAddr2: '',
    fromPlace: clean(company.city || company.state),
    fromPincode: pincode(company.pincode, 'Company'),
    fromStateCode: fromState,
    actualFromStateCode: fromState,

    toGstin: billGstin || 'URP',
    toTrdName: clean(billTo.name),
    toAddr1: clean(ship.address_line1).slice(0, 120),
    toAddr2: clean(ship.address_line2).slice(0, 120),
    toPlace: clean(ship.city || ship.district || ship.state),
    toPincode: pincode(ship.pin_code, 'Ship To'),
    toStateCode: billState,
    actualToStateCode: shipState,

    totalValue: round2(totals.taxableValue),
    cgstValue: round2(totals.cgst),
    sgstValue: round2(totals.sgst),
    igstValue: round2(totals.igst),
    cessValue: 0,
    TotNonAdvolVal: 0,
    OthValue: 0,
    totInvValue: round2(totals.grandTotal),

    transMode,
    transDistance: distance,
    transporterName: clean(eway?.transporter_name || header.transporter_name),
    transporterId,
    transDocNo: '',
    transDocDate: '',
    vehicleNo,
    vehicleType: String(eway?.vehicle_type || '').startsWith('Over') ? 'O' : 'R',

    mainHsnCode,
    itemList
  }
}

/** Wraps one or more bills in the file structure the portal expects. */
export function buildEwayBulkJson(bills) {
  return { version: JSON_VERSION, billLists: bills }
}

/** Triggers a browser download of the JSON file. */
export function downloadEwayJson(payload, fileName = 'E-WayBill_JSON.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
