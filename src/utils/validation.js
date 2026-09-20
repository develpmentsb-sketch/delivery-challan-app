// GSTIN: 2 digit state code + 10 char PAN + 1 entity code + 1 'Z' + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
const PIN_REGEX = /^[1-9][0-9]{5}$/
// Indian vehicle number, e.g. KA01AB1234 or KA-01-AB-1234
const VEHICLE_REGEX = /^[A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4}$/

export function isValidGSTIN(value) {
  if (!value) return true // optional field unless explicitly required
  return GSTIN_REGEX.test(String(value).toUpperCase().trim())
}

export function isValidPAN(value) {
  if (!value) return true
  return PAN_REGEX.test(String(value).toUpperCase().trim())
}

export function isValidPin(value) {
  if (!value) return true
  return PIN_REGEX.test(String(value).trim())
}

export function isValidVehicleNumber(value) {
  if (!value) return true
  return VEHICLE_REGEX.test(String(value).toUpperCase().replace(/\s+/g, '').trim())
}

export function validateChallan(challan, items) {
  const errors = {}

  if (!challan.partner_id) errors.partner_id = 'Please select a Vendor'
  if (!challan.bill_to?.name) errors.bill_to = 'Bill To address is required'
  if (!challan.ship_to?.name) errors.ship_to = 'Ship To address is required'
  if (!challan.dc_date) errors.dc_date = 'Delivery Challan date is required'

  if (challan.bill_to?.gstin && !isValidGSTIN(challan.bill_to.gstin)) {
    errors.bill_to_gstin = 'Bill To GSTIN format looks invalid'
  }
  if (challan.ship_to?.gstin && !isValidGSTIN(challan.ship_to.gstin)) {
    errors.ship_to_gstin = 'Ship To GSTIN format looks invalid'
  }
  if (challan.bill_to?.pin_code && !isValidPin(challan.bill_to.pin_code)) {
    errors.bill_to_pin = 'Bill To PIN code looks invalid'
  }
  if (challan.ship_to?.pin_code && !isValidPin(challan.ship_to.pin_code)) {
    errors.ship_to_pin = 'Ship To PIN code looks invalid'
  }
  if (challan.vehicle_number && !isValidVehicleNumber(challan.vehicle_number)) {
    errors.vehicle_number = 'Vehicle number format looks invalid (e.g. KA01AB1234)'
  }

  if (!items || items.length === 0) {
    errors.items = 'Add at least one item'
  } else {
    items.forEach((it, idx) => {
      if (!it.item_id && !it.item_name) {
        errors[`item_${idx}`] = `Row ${idx + 1}: select an item`
      }
      if (!(Number(it.quantity) > 0)) {
        errors[`item_qty_${idx}`] = `Row ${idx + 1}: quantity must be greater than 0`
      }
      if (Number(it.unit_price) < 0) {
        errors[`item_price_${idx}`] = `Row ${idx + 1}: unit price cannot be negative`
      }
    })
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function validatePartner(partner) {
  const errors = {}
  if (!partner.name) errors.name = 'Name is required'
  if (!partner.partner_type) errors.partner_type = 'Select a partner type'
  if (partner.gstin && !isValidGSTIN(partner.gstin)) errors.gstin = 'GSTIN format looks invalid'
  if (partner.pan && !isValidPAN(partner.pan)) errors.pan = 'PAN format looks invalid'
  if (partner.bill_to_pin && !isValidPin(partner.bill_to_pin)) errors.bill_to_pin = 'PIN code looks invalid'
  return { valid: Object.keys(errors).length === 0, errors }
}

export function validateItem(item, existingCodes = []) {
  const errors = {}
  if (!item.item_code) errors.item_code = 'Item Code is required'
  else if (existingCodes.includes(item.item_code.trim().toUpperCase())) {
    errors.item_code = 'This Item Code already exists'
  }
  if (!item.item_name) errors.item_name = 'Item Name is required'
  if (item.unit_price !== '' && Number(item.unit_price) < 0) errors.unit_price = 'Unit price cannot be negative'
  return { valid: Object.keys(errors).length === 0, errors }
}
