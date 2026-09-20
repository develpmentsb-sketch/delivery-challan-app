// Converts a number (rupees + paise) into Indian-style words for the
// "Amount in words" line on the printed Delivery Challan.
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
  'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n) {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`
}

function threeDigits(n) {
  const h = Math.floor(n / 100)
  const rest = n % 100
  let out = ''
  if (h) out += `${ONES[h]} Hundred${rest ? ' ' : ''}`
  if (rest) out += twoDigits(rest)
  return out.trim()
}

export function numberToIndianWords(amount) {
  const num = Math.round(Number(amount) || 0)
  if (num === 0) return 'Zero Rupees Only'

  const rupees = Math.floor(Math.abs(num))
  const isNegative = num < 0

  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = rupees % 1000

  const parts = []
  if (crore) parts.push(`${threeDigits(crore)} Crore`)
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`)
  if (hundred) parts.push(threeDigits(hundred))

  const words = parts.join(' ').trim() || 'Zero'
  return `${isNegative ? 'Minus ' : ''}${words} Rupees Only`
}
