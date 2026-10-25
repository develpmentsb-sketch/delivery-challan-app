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
