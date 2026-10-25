import { supabase } from '../lib/supabase'

// PostgREST returns at most 1000 rows per request, so page through bigger lists.
async function fetchAll(build) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

export async function getSettings(company) {
  const { data, error } = await supabase.from('acc_settings').select('*').eq('company_id', company).maybeSingle()
  if (error) throw error
  return data
}

export async function setupCompany(company, booksStart) {
  const { error } = await supabase.rpc('acc_seed_company', { p_company: company, p_books_start: booksStart })
  if (error) throw error
}

export const listGroups = (company) =>
  fetchAll(() => supabase.from('acc_groups').select('*').eq('company_id', company).order('name'))

export const listLedgers = (company) =>
  fetchAll(() => supabase.from('acc_ledgers').select('*').eq('company_id', company).order('name'))

export async function createGroup(company, { name, parent_id, nature }) {
  const { error } = await supabase.from('acc_groups').insert({ company_id: company, name, parent_id, nature })
  if (error) throw error
}

export async function saveLedger(company, ledger) {
  const row = {
    name: ledger.name.trim(), group_id: ledger.group_id,
    opening_balance: Number(ledger.opening_balance || 0), opening_type: ledger.opening_type || 'Dr',
    active: ledger.active !== false
  }
  if (ledger.id) {
    const { error } = await supabase.from('acc_ledgers').update(row).eq('id', ledger.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('acc_ledgers').insert({ ...row, company_id: company })
    if (error) throw error
  }
}

export async function deleteLedger(id) {
  const { error } = await supabase.from('acc_ledgers').delete().eq('id', id)
  if (error) throw new Error(error.message.includes('violates foreign key') ? 'This ledger has vouchers, so it cannot be deleted.' : error.message)
}

// Makes a ledger for every vendor (Sundry Creditors) and customer (Sundry Debtors) of this company.
export async function syncPartnerLedgers(company, groups, ledgers) {
  const gid = (n) => groups.find((g) => g.name === n)?.id
  const creditors = gid('Sundry Creditors'), debtors = gid('Sundry Debtors')
  if (!creditors || !debtors) throw new Error('Set up the accounts for this company first')
  const partners = await fetchAll(() => supabase.from('partners').select('id,name,partner_type,company_location_id').order('name'))
  const mine = partners.filter((p) => !p.company_location_id || p.company_location_id === company)
  const byPartner = new Set(ledgers.filter((l) => l.partner_id).map((l) => l.partner_id))
  const byName = new Map(ledgers.map((l) => [l.name.trim().toLowerCase(), l]))
  const fresh = []
  let linked = 0
  for (const p of mine) {
    if (byPartner.has(p.id)) continue
    const key = p.name.trim().toLowerCase()
    const existing = byName.get(key)
    if (existing) {
      if (!existing.partner_id) {
        const { error } = await supabase.from('acc_ledgers').update({ partner_id: p.id }).eq('id', existing.id)
        if (error) throw error
        linked++
      }
      continue
    }
    byName.set(key, { name: p.name })
    fresh.push({ company_id: company, name: p.name.trim(), group_id: p.partner_type === 'Customer' ? debtors : creditors, partner_id: p.id })
  }
  for (let i = 0; i < fresh.length; i += 200) {
    const { error } = await supabase.from('acc_ledgers').insert(fresh.slice(i, i + 200))
    if (error) throw error
  }
  return { created: fresh.length, linked }
}

export const listVouchers = (company, from, to) =>
  fetchAll(() =>
    supabase.from('acc_vouchers').select('*, acc_entries(*)')
      .eq('company_id', company).gte('voucher_date', from).lte('voucher_date', to)
      .order('voucher_date', { ascending: false }).order('voucher_no', { ascending: false })
  )

export async function saveVoucher({ id = null, company, type, date, narration, entries }) {
  const { data, error } = await supabase.rpc('acc_save_voucher', {
    p_id: id, p_company: company, p_type: type, p_date: date, p_narration: narration || null, p_entries: entries
  })
  if (error) throw error
  return data
}

export async function deleteVoucher(id) {
  const { error } = await supabase.from('acc_vouchers').delete().eq('id', id)
  if (error) throw error
}

export async function getTotals(company, from, to) {
  const { data, error } = await supabase.rpc('acc_ledger_totals', { p_company: company, p_from: from, p_to: to })
  if (error) throw error
  return data || []
}

export async function getStockValues(company) {
  const { data, error } = await supabase.from('acc_stock_values').select('*').eq('company_id', company)
  if (error) throw error
  return Object.fromEntries((data || []).map((r) => [r.fy, Number(r.closing_stock)]))
}

export async function saveClosingStock(company, fy, value) {
  const { error } = await supabase.from('acc_stock_values')
    .upsert({ company_id: company, fy, closing_stock: Number(value || 0) }, { onConflict: 'company_id,fy' })
  if (error) throw error
}
