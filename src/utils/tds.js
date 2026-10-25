// Suggests a TDS rate for a vendor from the TDS section and the vendor's PAN.
// The PAN is taken from the PAN field, or from the GSTIN (characters 3-12 of a GSTIN are the PAN).
// The 4th letter of a PAN is the holder type: P = individual, H = HUF, C = company,
// F = firm / LLP, T = trust, A = AOP, B = BOI, L = local authority, J = artificial person, G = government.
// Rates are the standard rates; the user can always change the rate.

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const HOLDER_TYPES = {
  P: 'Individual', H: 'HUF', C: 'Company', F: 'Firm / LLP', T: 'Trust',
  A: 'AOP', B: 'BOI', L: 'Local authority', J: 'Artificial person', G: 'Government'
}

export function panFromVendor(gstin, pan) {
  const p = String(pan || '').trim().toUpperCase()
  if (PAN_RE.test(p)) return p
  const g = String(gstin || '').trim().toUpperCase()
  if (g.length >= 12) {
    const fromGst = g.slice(2, 12)
    if (PAN_RE.test(fromGst)) return fromGst
  }
  return ''
}

// Returns { rate, note } or null when nothing can be suggested (no section chosen).
export function suggestTds(section, gstin, pan) {
  if (!section) return null
  const p = panFromVendor(gstin, pan)
  const type = p ? p[3] : ''
  const holder = type ? (HOLDER_TYPES[type] || 'Other') : ''
  const who = holder ? ` (${holder}, PAN ${p})` : ''
  const noPan = !p ? ' Add the GSTIN or PAN so the holder type can be checked. Without a PAN the rate is 20% (s.206AA).' : ''

  switch (section) {
    case '194C': {
      const low = type === 'P' || type === 'H'
      return { rate: low ? 1 : 2, note: `${low ? '1% for Individual / HUF' : '2% for company, firm and others'}${who}.${noPan}` }
    }
    case '194J':
      return { rate: 10, note: `10% for professional fees${who}. Use 2% for technical services / royalty.${noPan}` }
    case '194I':
      return { rate: 10, note: `10% for land, building, furniture${who}. Use 2% for plant & machinery.${noPan}` }
    case '194H':
      return { rate: 2, note: `2% on commission / brokerage${who}.${noPan}` }
    case '194Q':
      return { rate: 0.1, note: `0.1% on purchase of goods above Rs 50 lakh in the year${who}.${noPan}` }
    case '194A':
      return { rate: 10, note: `10% on interest${who}.${noPan}` }
    case '195':
      return { rate: null, note: 'Rate for non-residents depends on the type of income and tax treaty. Enter it manually.' }
    default:
      return { rate: null, note: '' }
  }
}
