import { stateCodeFromName } from '../lib/constants'

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Whether a transaction is intra-state (CGST+SGST) or inter-state (IGST),
 * based on the supplier's state (place of supply) vs the Ship To state.
 */
export function isIntraState(placeOfSupplyState, shipToState) {
  const a = stateCodeFromName(placeOfSupplyState) || String(placeOfSupplyState || '').trim()
  const b = stateCodeFromName(shipToState) || String(shipToState || '').trim()
  if (!a || !b) return true
  return a === b
}

/**
 * Computes taxable value + GST split for a single item row.
 * Returns a new object; does not mutate input.
 */
export function calculateItemRow(row, intraState) {
  const quantity = Number(row.quantity) || 0
  const unitPrice = Number(row.unit_price) || 0
  const gstRate = Number(row.gst_rate) || 0

  const taxableValue = round2(quantity * unitPrice)
  const gstAmount = round2((taxableValue * gstRate) / 100)

  let cgst = 0, sgst = 0, igst = 0
  if (intraState) {
    cgst = round2(gstAmount / 2)
    sgst = round2(gstAmount - cgst)
  } else {
    igst = gstAmount
  }

  const totalValue = round2(taxableValue + cgst + sgst + igst)

  return { ...row, taxable_value: taxableValue, cgst, sgst, igst, total_value: totalValue }
}

/**
 * Recalculates every row and returns { rows, totals }.
 */
export function calculateChallanTotals(items, intraState) {
  const rows = (items || []).map((row) => calculateItemRow(row, intraState))

  const totals = rows.reduce(
    (acc, r) => ({
      totalQuantity: round2(acc.totalQuantity + (Number(r.quantity) || 0)),
      taxableValue: round2(acc.taxableValue + r.taxable_value),
      cgst: round2(acc.cgst + r.cgst),
      sgst: round2(acc.sgst + r.sgst),
      igst: round2(acc.igst + r.igst),
      grandTotal: round2(acc.grandTotal + r.total_value)
    }),
    { totalQuantity: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0, grandTotal: 0 }
  )

  return { rows, totals }
}

export const formatCurrency = (n) =>
  `\u20B9${round2(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const formatNumber = (n, decimals = 2) =>
  round2(n).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
