// GSTIN helpers (work offline, no API needed).
// GSTIN layout: 2-digit state code + 10-character PAN + entity number + 'Z' + check character.

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

export function gstinCheckChar(first14) {
  let sum = 0
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i])
    if (v < 0) return ''
    const prod = v * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(prod / 36) + (prod % 36)
  }
  return CHARS[(36 - (sum % 36)) % 36]
}

// 'valid' | 'invalid' | 'incomplete'
export function gstinStatus(value) {
  const g = String(value || '').trim().toUpperCase()
  if (g.length < 15) return 'incomplete'
  if (g.length > 15 || !GSTIN_RE.test(g)) return 'invalid'
  return gstinCheckChar(g.slice(0, 14)) === g[14] ? 'valid' : 'invalid'
}

// Details that can be read straight from a valid GSTIN.
export function gstinDetails(value, states = []) {
  if (gstinStatus(value) !== 'valid') return null
  const g = String(value).trim().toUpperCase()
  const code = g.slice(0, 2)
  const st = states.find((s) => String(s.code).padStart(2, '0') === code)
  return { pan: g.slice(2, 12), stateCode: code, stateName: st ? st.name : '' }
}

// ---------------------------------------------------------------------------
// Read the text copied from the GST portal "Search Taxpayer" result page.
// ---------------------------------------------------------------------------
const PORTAL_LABELS = [
  'Legal Name of Business', 'Trade Name', 'Effective Date of registration', 'Constitution of Business',
  'GSTIN / UIN Status', 'Taxpayer Type', 'Administrative Office', 'Other Office', 'Principal Place of Business',
  'Whether Aadhaar Authenticated?', 'Whether e-KYC Verified?', 'Additional Trade Name',
  'Date of Cancellation', 'Nature of Core Business Activity', 'Nature Of Core Business Activity'
]
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
const LABEL_SET = new Set(PORTAL_LABELS.map(norm))
const isLabel = (l) => LABEL_SET.has(norm(l))
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s(\-/&.])([a-z])/g, (m, a, b) => a + b.toUpperCase())

export function parseGstPortalText(text, states = []) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null
  const map = {}
  let i = 0
  while (i < lines.length) {
    if (!isLabel(lines[i])) { i++; continue }
    const labels = [norm(lines[i])]
    let j = i + 1
    while (j < lines.length && isLabel(lines[j])) { labels.push(norm(lines[j])); j++ }
    const vals = []
    while (j < lines.length && !isLabel(lines[j])) { vals.push(lines[j]); j++ }
    if (labels.length === 1) map[labels[0]] = vals
    else labels.forEach((lb, k) => { if (vals[k] !== undefined) map[lb] = [vals[k]] })
    // row-style copy: the three office blocks come as one run of lines
    if (labels.includes('principal place of business') && labels.length > 1) {
      const lastRange = vals.map((v, k) => (/^range\b/i.test(v) ? k : -1)).filter((k) => k >= 0).pop()
      map['principal place of business'] = lastRange !== undefined ? vals.slice(lastRange + 1) : vals.slice(-3)
    }
    i = j
  }

  const gstinMatch = String(text).toUpperCase().match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/)
  const legal = (map['legal name of business'] || []).join(' ').trim()
  const trade = (map['trade name'] || []).join(' ').trim()
  const taxpayer = (map['taxpayer type'] || []).join(' ').trim()

  // Principal place of business: "..., city, district, state, PIN"
  let address1 = '', address2 = '', city = '', district = '', stateName = '', stateCode = '', pin = ''
  const ppob = (map['principal place of business'] || []).join(' ').replace(/\s+/g, ' ').trim()
  if (ppob) {
    let body = ppob
    const pm = body.match(/(\d{6})\s*[.,]?\s*$/)
    if (pm) { pin = pm[1]; body = body.slice(0, pm.index).replace(/[,\s]+$/, '') }
    const parts = body.split(',').map((p) => p.trim()).filter(Boolean)
    const st = parts.length ? states.find((s) => norm(s.name) === norm(parts[parts.length - 1])) : null
    if (st) { stateName = st.name; stateCode = String(st.code).padStart(2, '0'); parts.pop() }
    if (parts.length > 2) district = titleCase(parts.pop())
    if (parts.length > 1) city = titleCase(parts.pop())
    let l1 = ''
    const rest = []
    parts.forEach((p) => { if (!rest.length && (l1 + p).length <= 45) l1 = l1 ? `${l1}, ${p}` : p; else rest.push(p) })
    address1 = l1 || (rest.shift() || '')
    address2 = rest.join(', ')
  }
  if (!stateCode && gstinMatch) stateCode = gstinMatch[0].slice(0, 2)

  return {
    gstin: gstinMatch ? gstinMatch[0] : '',
    name: titleCase(trade || legal), legalName: titleCase(legal), tradeName: titleCase(trade),
    taxpayerType: taxpayer, address1, address2, city, district, state: stateName, stateCode, pin
  }
}
