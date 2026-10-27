import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateLedger, validateBankDetails, validateGroup, buildChartTree, flattenGroups, descendantGroupIds,
  groupPath, openingTotals, signedBalance, formatSigned, suggestLedgerCode, currentFyStart, fyLabel,
  friendlyError, isDeleteBlocked, NORMAL_SIDE
} from '../src/lib/ledger.js'

const TODAY = new Date(2026, 9, 27) // 27 Oct 2026
const assetGroup = { id: 'g1', account_type: 'Asset' }
const base = {
  ledger_code: 'L0001', ledger_name: 'Cash', group_id: 'g1', opening_balance: '', balance_type: 'Debit',
  effective_date: '', gst_applicable: false, gst_tax_category: '', remarks: ''
}
const check = (over, group = assetGroup) => validateLedger({ ...base, ...over }, { group, today: TODAY })

test('a minimal ledger is valid', () => {
  const { errors, warnings } = check({})
  assert.deepEqual(errors, {})
  assert.deepEqual(warnings, [])
})

test('code and name are required; code format is enforced', () => {
  assert.ok(check({ ledger_code: '' }).errors.ledger_code)
  assert.ok(check({ ledger_code: 'a b' }).errors.ledger_code)
  assert.ok(check({ ledger_code: 'X' }).errors.ledger_code)
  assert.equal(check({ ledger_code: ' bank-01 ' }).errors.ledger_code, undefined)
  assert.ok(check({ ledger_name: '   ' }).errors.ledger_name)
  assert.ok(check({ group_id: '' }).errors.group_id)
})

test('opening balance rules', () => {
  assert.ok(check({ opening_balance: '-5' }).errors.opening_balance)
  assert.ok(check({ opening_balance: 'abc' }).errors.opening_balance)
  assert.ok(check({ opening_balance: '10.555' }).errors.opening_balance)
  assert.ok(check({ opening_balance: '1e20' }).errors.opening_balance)
  assert.equal(check({ opening_balance: '100.50', effective_date: '2026-04-01' }).errors.opening_balance, undefined)
})

test('an opening balance needs a valid, non-future effective date', () => {
  assert.ok(check({ opening_balance: '100' }).errors.effective_date)
  assert.ok(check({ opening_balance: '100', effective_date: '2026-02-30' }).errors.effective_date)
  assert.ok(check({ opening_balance: '100', effective_date: '2027-04-01' }).errors.effective_date)
  assert.equal(check({ opening_balance: '100', effective_date: '2026-04-01' }).errors.effective_date, undefined)
})

test('warns (does not block) on a mid-year date or an abnormal balance side', () => {
  const mid = check({ opening_balance: '100', effective_date: '2026-06-15' })
  assert.deepEqual(mid.errors, {})
  assert.equal(mid.warnings.length, 1)
  const abnormal = check({ opening_balance: '100', effective_date: '2026-04-01', balance_type: 'Credit' })
  assert.deepEqual(abnormal.errors, {})
  assert.match(abnormal.warnings[0], /normally carry a Debit balance/)
  const liability = check({ opening_balance: '100', effective_date: '2026-04-01', balance_type: 'Credit' }, { id: 'g1', account_type: 'Liability' })
  assert.deepEqual(liability.warnings, [])
})

test('GST category is required when GST is applicable', () => {
  assert.ok(check({ gst_applicable: true }).errors.gst_tax_category)
  assert.equal(check({ gst_applicable: true, gst_tax_category: 'GST 18%' }).errors.gst_tax_category, undefined)
})

test('bank details: IFSC and account number formats', () => {
  assert.deepEqual(validateBankDetails({ bank_name: 'HDFC Bank', ifsc: 'hdfc0001234', account_number: '123456789012' }), {})
  assert.ok(validateBankDetails({ bank_name: '' }).bank_name)
  assert.ok(validateBankDetails({ bank_name: 'X', ifsc: 'HDFC1001234' }).ifsc)
  assert.ok(validateBankDetails({ bank_name: 'X', account_number: '12AB' }).account_number)
  assert.ok(validateBankDetails({ bank_name: 'X', account_number: '12345678' }).account_number)
})

test('group validation', () => {
  assert.ok(validateGroup({ code: '', name: 'A', account_type: 'Asset' }).code)
  assert.ok(validateGroup({ code: 'AB', name: '', account_type: 'Asset' }).name)
  assert.ok(validateGroup({ code: 'AB', name: 'A', parent_id: '', account_type: '' }).account_type)
  assert.deepEqual(validateGroup({ code: 'AB', name: 'A', parent_id: 'p', account_type: '' }, { parent: { active: true } }), {})
  assert.ok(validateGroup({ code: 'AB', name: 'A', parent_id: 'p' }, { parent: { active: false } }).parent_id)
})

const groups = [
  { id: 'a', name: 'Assets', parent_id: null, account_type: 'Asset', sort_order: 1, active: true },
  { id: 'ca', name: 'Current Assets', parent_id: 'a', account_type: 'Asset', sort_order: 2, active: true },
  { id: 'bank', name: 'Bank Accounts', parent_id: 'ca', account_type: 'Asset', sort_order: 3, active: true },
  { id: 'l', name: 'Liabilities', parent_id: null, account_type: 'Liability', sort_order: 9, active: true }
]
const ledgers = [
  { id: '1', ledger_code: 'L0002', group_id: 'bank', opening_balance: 1000, balance_type: 'Debit' },
  { id: '2', ledger_code: 'L0001', group_id: 'ca', opening_balance: 250.5, balance_type: 'Debit' },
  { id: '3', ledger_code: 'L0003', group_id: 'l', opening_balance: 1250.5, balance_type: 'Credit' }
]

test('tree nests groups, attaches ledgers and rolls up signed totals', () => {
  const tree = buildChartTree(groups, ledgers)
  assert.deepEqual(tree.map((n) => n.group.id), ['a', 'l'])
  const assets = tree[0]
  assert.equal(assets.children[0].group.id, 'ca')
  assert.equal(assets.children[0].children[0].group.id, 'bank')
  assert.deepEqual(assets.children[0].ledgers.map((x) => x.id), ['2'])
  assert.equal(assets.total, 1250.5)
  assert.equal(tree[1].total, -1250.5)
})

test('flatten, descendants and path helpers', () => {
  assert.deepEqual(flattenGroups(groups).map((g) => [g.id, g.depth]), [['a', 0], ['ca', 1], ['bank', 2], ['l', 0]])
  assert.deepEqual([...descendantGroupIds(groups, 'ca')].sort(), ['bank', 'ca'])
  assert.equal(groupPath(groups, 'bank'), 'Assets > Current Assets > Bank Accounts')
})

test('opening balances tally check', () => {
  assert.deepEqual(openingTotals(ledgers), { debit: 1250.5, credit: 1250.5, difference: 0 })
  assert.equal(openingTotals(ledgers.slice(0, 2)).difference, 1250.5)
})

test('signed balances and formatting', () => {
  assert.equal(signedBalance(10, 'Credit'), -10)
  assert.equal(formatSigned(0), '-')
  assert.equal(formatSigned(1234567.5), '12,34,567.50 Dr')
  assert.equal(formatSigned(-20), '20.00 Cr')
  assert.equal(NORMAL_SIDE.Income, 'Credit')
})

test('code suggestion and financial year', () => {
  assert.equal(suggestLedgerCode([]), 'L0001')
  assert.equal(suggestLedgerCode([{ ledger_code: 'L0009' }, { ledger_code: 'CASH' }]), 'L0010')
  assert.equal(currentFyStart(new Date(2026, 9, 27)), '2026-04-01')
  assert.equal(currentFyStart(new Date(2027, 1, 10)), '2026-04-01')
  assert.equal(fyLabel(new Date(2027, 1, 10)), '2026-27')
  assert.equal(fyLabel(new Date(2099, 5, 1)), '2099-00')
})

test('database errors become readable messages', () => {
  assert.match(friendlyError({ code: '23505', message: 'duplicate key value violates unique constraint "chart_of_accounts_code_uidx"' }), /ledger code is already in use/)
  assert.match(friendlyError({ code: '42501', message: 'new row violates row-level security policy' }), /role does not allow/)
  assert.match(friendlyError({ message: 'Could not find the table public.chart_of_accounts in the schema cache' }), /add_ledger_master\.sql/)
  assert.equal(isDeleteBlocked({ message: 'This ledger is used in transactions or linked to other records, so it cannot be deleted. Deactivate it instead.' }), true)
  assert.equal(isDeleteBlocked({ message: 'network error' }), false)
})
