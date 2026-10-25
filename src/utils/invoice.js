// Invoice maths. The database function acc_save_invoice repeats the same rules, so these
// numbers are what you see on screen and what gets posted to the books.

export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28]
export const UOMS = ['Nos', 'Pcs', 'Kg', 'Gm', 'Ltr', 'Mtr', 'Box', 'Set', 'Pair', 'Unit', 'Hrs', 'Job', 'Month']

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const blankLine = () => ({ description: '', hsn: '', qty: '1', uom: 'Nos', rate: '', discount_pct: '0', gst_rate: '18' })

export function lineTaxable(l) {
  return r2((Number(l.qty) || 0) * (Number(l.rate) || 0) * (1 - (Number(l.discount_pct) || 0) / 100))
}

export function calcInvoice(lines, supply, roundOn = true) {
  const rows = lines.map((l) => ({ ...l, taxable: lineTaxable(l) }))
  const buckets = new Map()
  rows.forEach((l) => { const g = Number(l.gst_rate) || 0; buckets.set(g, (buckets.get(g) || 0) + l.taxable) })
  let taxable = 0, cgst = 0, sgst = 0, igst = 0
  buckets.forEach((tx, g) => {
    tx = r2(tx)
    taxable += tx
    if (supply === 'Intra') { cgst += r2((tx * g) / 200); sgst += r2((tx * g) / 200) } else { igst += r2((tx * g) / 100) }
  })
  taxable = r2(taxable); cgst = r2(cgst); sgst = r2(sgst); igst = r2(igst)
  let total = r2(taxable + cgst + sgst + igst)
  let roundOff = 0
  if (roundOn) { roundOff = r2(Math.round(total) - total); total = r2(total + roundOff) }
  return { rows, taxable, cgst, sgst, igst, roundOff, total, tax: r2(cgst + sgst + igst) }
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function below1000(n) {
  let s = ''
  if (n >= 100) { s += `${ONES[Math.floor(n / 100)]} Hundred `; n %= 100 }
  if (n >= 20) { s += `${TENS[Math.floor(n / 10)]} `; n %= 10 }
  if (n > 0) s += `${ONES[n]} `
  return s
}
export function amountInWords(amount) {
  const total = Math.round(Math.abs(Number(amount) || 0) * 100)
  let rupees = Math.floor(total / 100)
  const paise = total % 100
  if (rupees === 0 && paise === 0) return 'Zero Rupees Only'
  let s = ''
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000
  const lakh = Math.floor(rupees / 100000); rupees %= 100000
  const thousand = Math.floor(rupees / 1000); rupees %= 1000
  if (crore) s += `${below1000(crore)}Crore `
  if (lakh) s += `${below1000(lakh)}Lakh `
  if (thousand) s += `${below1000(thousand)}Thousand `
  s += below1000(rupees)
  s = s.trim()
  let out = s ? `${s} Rupees` : ''
  if (paise) out += `${out ? ' and ' : ''}${below1000(paise).trim()} Paise`
  return `${out} Only`
}
