// Pure helpers for the Ledger Master / Chart of Accounts.
// No React and no Supabase in here, so everything can be unit-tested (see tests/ledger.test.mjs).

export const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

// The side on which each type of account normally carries its balance.
export const NORMAL_SIDE = {
  Asset: 'Debit',
  Expense: 'Debit',
  Liability: 'Credit',
  Equity: 'Credit',
  Income: 'Credit'
}

export const GST_TAX_CATEGORIES = [
  'GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%',
  'Exempt', 'Nil Rated', 'Non-GST', 'Reverse Charge'
]

export const BANK_ACCOUNT_TYPES = ['Current', 'Savings', 'Cash Credit', 'Overdraft']

export const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const BANK_ACCOUNT_NO_RE = /^[0-9]{9,18}$/
export const LEDGER_CODE_RE = /^[A-Z0-9][A-Z0-9._-]{1,19}$/
export const GROUP_CODE_RE = /^[A-Z0-9][A-Z0-9._-]{1,19}$/

const MAX_AMOUNT = 99999999999999.99

// ---------------------------------------------------------------------
// Financial year (India: 1 April - 31 March)
// ---------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0')

export function fyStartYear(date = new Date()) {
  return date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1
}

/** First day of the financial year that contains `date`, as YYYY-MM-DD. */
export function currentFyStart(date = new Date()) {
  return `${fyStartYear(date)}-04-01`
}

/** e.g. "2026-27" */
export function fyLabel(date = new Date()) {
  const y = fyStartYear(date)
  return `${y}-${pad((y + 1) % 100)}`
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// ---------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------
const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatAmount(n) {
  return inr.format(Number(n) || 0)
}

/** Signed balance: debit is positive, credit is negative. */
export function signedBalance(amount, balanceType) {
  const a = Number(amount) || 0
  return balanceType === 'Credit' ? -a : a
}

/** 1500 -> "1,500.00 Dr", -20 -> "20.00 Cr", 0 -> "-" */
export function formatSigned(signed) {
  const rounded = Math.round((Number(signed) || 0) * 100) / 100
  if (rounded === 0) return '-'
  return `${formatAmount(Math.abs(rounded))} ${rounded > 0 ? 'Dr' : 'Cr'}`
}

/** Total debit and credit of the opening balances, to check they tally. */
export function openingTotals(ledgers) {
  let debit = 0
  let credit = 0
  for (const l of ledgers) {
    const amt = Number(l.opening_balance) || 0
    if (l.balance_type === 'Credit') credit += amt
    else debit += amt
  }
  debit = Math.round(debit * 100) / 100
  credit = Math.round(credit * 100) / 100
  return { debit, credit, difference: Math.round((debit - credit) * 100) / 100 }
}

// ---------------------------------------------------------------------
// Codes
// ---------------------------------------------------------------------
/** Next free "L0001"-style code. */
export function suggestLedgerCode(ledgers) {
  let max = 0
  for (const l of ledgers) {
    const m = /^L(\d+)$/i.exec(l.ledger_code || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `L${String(max + 1).padStart(4, '0')}`
}

export function normalizeCode(code) {
  return String(code || '').trim().toUpperCase()
}

// ---------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------
function hasMoreThanTwoDecimals(value) {
  const s = String(value)
  const i = s.indexOf('.')
  return i !== -1 && s.length - i - 1 > 2
}

/**
 * Returns { errors, warnings }.
 *  errors   -> block saving
 *  warnings -> shown, but the user may still save
 * `ctx.group` is the selected account group, `ctx.today` can be injected for tests.
 */
export function validateLedger(form, ctx = {}) {
  const errors = {}
  const warnings = []
  const group = ctx.group || null

  const code = normalizeCode(form.ledger_code)
  if (!code) errors.ledger_code = 'Ledger code is required.'
  else if (!LEDGER_CODE_RE.test(code)) {
    errors.ledger_code = 'Use 2-20 letters, numbers, dot, dash or underscore (e.g. L0001).'
  }

  const name = String(form.ledger_name || '').trim()
  if (!name) errors.ledger_name = 'Ledger name is required.'
  else if (name.length > 120) errors.ledger_name = 'Ledger name can be at most 120 characters.'

  if (!form.group_id) errors.group_id = 'Choose the account group this ledger belongs to.'

  const opening = form.opening_balance === '' || form.opening_balance == null ? 0 : Number(form.opening_balance)
  if (Number.isNaN(opening)) errors.opening_balance = 'Opening balance must be a number.'
  else if (opening < 0) errors.opening_balance = 'Enter the amount without a minus sign and pick Debit or Credit.'
  else if (opening > MAX_AMOUNT) errors.opening_balance = 'Opening balance is too large.'
  else if (hasMoreThanTwoDecimals(form.opening_balance)) errors.opening_balance = 'Use at most 2 decimal places.'

  if (!['Debit', 'Credit'].includes(form.balance_type)) errors.balance_type = 'Choose Debit or Credit.'

  if (!errors.opening_balance && opening > 0) {
    if (!form.effective_date) {
      errors.effective_date = 'An opening balance needs an effective date (normally the first day of the financial year).'
    } else if (!isValidIsoDate(form.effective_date)) {
      errors.effective_date = 'Enter a valid date.'
    } else {
      const today = ctx.today || new Date()
      const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
      if (form.effective_date > todayIso) {
        errors.effective_date = 'The effective date of an opening balance cannot be in the future.'
      } else if (!form.effective_date.endsWith('-04-01')) {
        warnings.push('Opening balances are normally dated 1 April, the first day of the financial year.')
      }
    }
    if (group && form.balance_type !== NORMAL_SIDE[group.account_type]) {
      warnings.push(
        `${group.account_type} accounts normally carry a ${NORMAL_SIDE[group.account_type]} balance. ` +
        `Please check that ${form.balance_type} is correct.`
      )
    }
  } else if (form.effective_date && !isValidIsoDate(form.effective_date)) {
    errors.effective_date = 'Enter a valid date.'
  }

  if (form.gst_applicable && !String(form.gst_tax_category || '').trim()) {
    errors.gst_tax_category = 'Choose a GST tax category.'
  }

  if (String(form.remarks || '').length > 500) errors.remarks = 'Remarks can be at most 500 characters.'

  return { errors, warnings }
}

/** Validates the bank section (admin only). Returns { field: message }. */
export function validateBankDetails(bank) {
  const errors = {}
  if (!String(bank.bank_name || '').trim()) errors.bank_name = 'Bank name is required for a bank ledger.'
  const ifsc = String(bank.ifsc || '').trim().toUpperCase()
  if (ifsc && !IFSC_RE.test(ifsc)) errors.ifsc = 'IFSC must look like HDFC0001234 (4 letters, 0, then 6 letters or digits).'
  const acc = String(bank.account_number || '').replace(/\s+/g, '')
  if (acc && !BANK_ACCOUNT_NO_RE.test(acc)) errors.account_number = 'Account number must be 9 to 18 digits.'
  return errors
}

export function validateGroup(form, ctx = {}) {
  const errors = {}
  const code = normalizeCode(form.code)
  if (!code) errors.code = 'Group code is required.'
  else if (!GROUP_CODE_RE.test(code)) errors.code = 'Use 2-20 letters, numbers, dot, dash or underscore.'

  const name = String(form.name || '').trim()
  if (!name) errors.name = 'Group name is required.'
  else if (name.length > 120) errors.name = 'Group name can be at most 120 characters.'

  if (!form.parent_id && !ACCOUNT_TYPES.includes(form.account_type)) {
    errors.account_type = 'Choose the account type for a top-level group.'
  }
  if (form.parent_id && ctx.parent && ctx.parent.active === false) {
    errors.parent_id = 'The parent group is inactive.'
  }
  return errors
}

// ---------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------
const bySort = (a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.name).localeCompare(String(b.name))

/**
 * Builds the chart-of-accounts tree.
 * Returns an array of root group nodes:
 *   { group, children: [node...], ledgers: [ledger...], total }
 * `total` is the signed opening balance of everything underneath (debit +, credit -).
 */
export function buildChartTree(groups, ledgers) {
  const nodes = new Map()
  for (const g of groups) nodes.set(g.id, { group: g, children: [], ledgers: [], total: 0 })

  const roots = []
  for (const g of [...groups].sort(bySort)) {
    const node = nodes.get(g.id)
    const parent = g.parent_id ? nodes.get(g.parent_id) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  for (const l of [...ledgers].sort((a, b) => String(a.ledger_code).localeCompare(String(b.ledger_code)))) {
    const node = nodes.get(l.group_id)
    if (node) node.ledgers.push(l)
  }

  const sum = (node) => {
    let total = node.ledgers.reduce((t, l) => t + signedBalance(l.opening_balance, l.balance_type), 0)
    for (const child of node.children) total += sum(child)
    node.total = Math.round(total * 100) / 100
    return node.total
  }
  roots.forEach(sum)
  return roots
}

/** Groups in tree order with a `depth`, for indented <select> options. */
export function flattenGroups(groups) {
  const out = []
  const walk = (nodes, depth) => {
    for (const n of nodes) {
      out.push({ ...n.group, depth })
      walk(n.children, depth + 1)
    }
  }
  walk(buildChartTree(groups, []), 0)
  return out
}

/** ids of a group and every group underneath it. */
export function descendantGroupIds(groups, groupId) {
  const ids = new Set([groupId])
  let grew = true
  while (grew) {
    grew = false
    for (const g of groups) {
      if (g.parent_id && ids.has(g.parent_id) && !ids.has(g.id)) {
        ids.add(g.id)
        grew = true
      }
    }
  }
  return ids
}

/** "Assets > Current Assets > Bank Accounts" */
export function groupPath(groups, groupId) {
  const byId = new Map(groups.map((g) => [g.id, g]))
  const parts = []
  let cur = byId.get(groupId)
  let guard = 0
  while (cur && guard++ < 20) {
    parts.unshift(cur.name)
    cur = cur.parent_id ? byId.get(cur.parent_id) : null
  }
  return parts.join(' > ')
}

/** Turns a database / API error into a message a person can act on. */
export function friendlyError(err) {
  const msg = String(err?.message || err || '')
  if (err?.code === '23505' || /duplicate key/i.test(msg)) {
    if (/chart_of_accounts_code/i.test(msg)) return 'This ledger code is already in use. Please choose a different code.'
    if (/chart_of_accounts_group_name/i.test(msg)) return 'A ledger with this name already exists in the same group.'
    if (/account_groups_code/i.test(msg)) return 'This group code is already in use. Please choose a different code.'
    if (/account_groups_sibling_name/i.test(msg)) return 'A group with this name already exists under the same parent.'
    return 'A record with the same code or name already exists.'
  }
  if (err?.code === '42501' || /row-level security/i.test(msg)) {
    return 'Your role does not allow this action.'
  }
  if (/schema cache|does not exist|relation .* does not exist/i.test(msg)) {
    return 'The ledger tables are not set up yet. Run supabase/add_ledger_master.sql in the Supabase SQL editor.'
  }
  return msg || 'Something went wrong. Please try again.'
}

/** True when the database refused a delete because the record is in use. */
export function isDeleteBlocked(err) {
  return /cannot be deleted/i.test(String(err?.message || ''))
}
