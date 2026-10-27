import { supabase } from '../lib/supabase'
import { normalizeCode, friendlyError } from '../lib/ledger'

async function run(promise) {
  const { data, error } = await promise
  if (error) {
    const e = new Error(friendlyError(error))
    e.code = error.code
    e.original = error
    throw e
  }
  return data
}

// ---------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------
export function listGroups() {
  return run(supabase.from('account_groups').select('*').order('sort_order').order('name'))
}

function groupPayload(form) {
  return {
    code: normalizeCode(form.code),
    name: String(form.name).trim(),
    parent_id: form.parent_id || null,
    account_type: form.account_type,
    sort_order: Number(form.sort_order) || 0,
    active: form.active !== false,
    remarks: String(form.remarks || '').trim() || null
  }
}

export function createGroup(form) {
  return run(supabase.from('account_groups').insert(groupPayload(form)).select().single())
}

export async function updateGroup(id, form, { isSystem = false } = {}) {
  const payload = groupPayload(form)
  // standard groups: only name, order, remarks and status may change
  if (isSystem) {
    delete payload.code
    delete payload.parent_id
    delete payload.account_type
  }
  await run(supabase.from('account_groups').update(payload).eq('id', id))
}

export async function setGroupActive(id, active) {
  await run(supabase.from('account_groups').update({ active }).eq('id', id))
}

export async function deleteGroup(id) {
  await run(supabase.from('account_groups').delete().eq('id', id))
}

// ---------------------------------------------------------------------
// Ledgers
// ---------------------------------------------------------------------
export function listLedgers() {
  return run(supabase.from('chart_of_accounts').select('*').order('ledger_code'))
}

function ledgerPayload(form) {
  const opening = form.opening_balance === '' || form.opening_balance == null ? 0 : Number(form.opening_balance)
  return {
    ledger_code: normalizeCode(form.ledger_code),
    ledger_name: String(form.ledger_name).trim(),
    group_id: form.group_id,
    account_subgroup: String(form.account_subgroup || '').trim() || null,
    opening_balance: opening,
    balance_type: form.balance_type,
    effective_date: form.effective_date || null,
    gst_applicable: Boolean(form.gst_applicable),
    gst_tax_category: form.gst_applicable ? String(form.gst_tax_category || '').trim() || null : null,
    is_bank_account: Boolean(form.is_bank_account),
    cost_centre_applicable: Boolean(form.cost_centre_applicable),
    active: form.active !== false,
    remarks: String(form.remarks || '').trim() || null
  }
}

export function createLedger(form) {
  return run(supabase.from('chart_of_accounts').insert(ledgerPayload(form)).select().single())
}

export async function updateLedger(id, form) {
  await run(supabase.from('chart_of_accounts').update(ledgerPayload(form)).eq('id', id))
}

export async function setLedgerActive(id, active) {
  await run(supabase.from('chart_of_accounts').update({ active }).eq('id', id))
}

/** Throws an Error whose message explains why, when the ledger is in use. */
export async function deleteLedger(id) {
  await run(supabase.from('chart_of_accounts').delete().eq('id', id))
}

export async function isDuplicateLedgerCode(code, excludeId = null) {
  const c = normalizeCode(code)
  if (!c) return false
  let q = supabase.from('chart_of_accounts').select('id').eq('ledger_code', c)
  if (excludeId) q = q.neq('id', excludeId)
  const rows = await run(q)
  return rows.length > 0
}

// ---------------------------------------------------------------------
// Bank details (admin only; RLS returns nothing for other roles)
// ---------------------------------------------------------------------
export async function getBankDetails(ledgerId) {
  const rows = await run(supabase.from('ledger_bank_details').select('*').eq('ledger_id', ledgerId).limit(1))
  return rows[0] || null
}

export async function saveBankDetails(ledgerId, bank) {
  const payload = {
    ledger_id: ledgerId,
    bank_name: String(bank.bank_name || '').trim(),
    branch_name: String(bank.branch_name || '').trim() || null,
    account_holder: String(bank.account_holder || '').trim() || null,
    account_number: String(bank.account_number || '').replace(/\s+/g, '') || null,
    ifsc: String(bank.ifsc || '').trim().toUpperCase() || null,
    account_type: String(bank.account_type || '').trim() || null
  }
  await run(supabase.from('ledger_bank_details').upsert(payload, { onConflict: 'ledger_id' }))
}

export async function removeBankDetails(ledgerId) {
  await run(supabase.from('ledger_bank_details').delete().eq('ledger_id', ledgerId))
}

// ---------------------------------------------------------------------
// Audit history (admin only)
// ---------------------------------------------------------------------
export function listAudit(tableName, recordId) {
  return run(
    supabase
      .from('audit_logs')
      .select('id, action, old_data, new_data, changed_by_email, changed_at')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('changed_at', { ascending: false })
      .limit(100)
  )
}
