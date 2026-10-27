import React, { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, AlertTriangle, Pencil } from 'lucide-react'
import AuditHistory from './AuditHistory'
import {
  GST_TAX_CATEGORIES, BANK_ACCOUNT_TYPES, NORMAL_SIDE, flattenGroups, validateLedger, validateBankDetails,
  normalizeCode, suggestLedgerCode, currentFyStart, fyLabel, groupPath
} from '../../lib/ledger'
import {
  createLedger, updateLedger, getBankDetails, saveBankDetails, removeBankDetails
} from '../../services/ledgerService'
import { useToast } from '../../context/ToastContext'

const EMPTY = {
  ledger_code: '', ledger_name: '', group_id: '', account_subgroup: '', opening_balance: '', balance_type: 'Debit',
  effective_date: '', gst_applicable: false, gst_tax_category: '', is_bank_account: false,
  cost_centre_applicable: false, active: true, remarks: ''
}
const EMPTY_BANK = { bank_name: '', branch_name: '', account_holder: '', account_number: '', ifsc: '', account_type: 'Current' }

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-brick">{error}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h4 className="mb-3 border-b border-navy-100 pb-1 text-sm font-semibold text-navy">{title}</h4>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/**
 * mode: 'create' | 'edit' | 'view'
 * `ledger` is the record to edit/view. For "duplicate", pass mode='create' with `template`.
 */
export default function LedgerFormModal({
  open, mode, ledger, template, defaultGroupId = '', groups, ledgers,
  canBanking, canAudit, canWrite, onClose, onSaved, onEditRequest
}) {
  const toast = useToast()
  const viewOnly = mode === 'view'
  const editing = mode === 'edit' || mode === 'view'
  const [form, setForm] = useState(EMPTY)
  const [bank, setBank] = useState(EMPTY_BANK)
  const [hadBank, setHadBank] = useState(false)
  const [errors, setErrors] = useState({})
  const [bankErrors, setBankErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('details')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    setTab('details'); setErrors({}); setBankErrors({}); setSubmitted(false)
    setBank(EMPTY_BANK); setHadBank(false)
    let alive = true
    if (editing && ledger) {
      setForm({
        ...EMPTY, ...ledger,
        opening_balance: ledger.opening_balance === 0 ? '' : String(ledger.opening_balance),
        effective_date: ledger.effective_date || '',
        account_subgroup: ledger.account_subgroup || '',
        gst_tax_category: ledger.gst_tax_category || '',
        remarks: ledger.remarks || ''
      })
      if (ledger.is_bank_account && canBanking) {
        getBankDetails(ledger.id)
          .then((b) => { if (alive && b) { setBank({ ...EMPTY_BANK, ...b }); setHadBank(true) } })
          .catch((e) => toast.error(e.message))
      }
    } else if (template) {
      setForm({
        ...EMPTY, ...template, ledger_code: suggestLedgerCode(ledgers), ledger_name: `${template.ledger_name} (Copy)`,
        opening_balance: '', effective_date: '', remarks: template.remarks || '', gst_tax_category: template.gst_tax_category || '',
        account_subgroup: template.account_subgroup || ''
      })
    } else {
      const g = groups.find((x) => x.id === defaultGroupId)
      setForm({ ...EMPTY, ledger_code: suggestLedgerCode(ledgers), group_id: defaultGroupId || '', balance_type: g ? NORMAL_SIDE[g.account_type] : 'Debit' })
    }
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ledger, template, defaultGroupId])

  const group = groups.find((g) => g.id === form.group_id) || null
  const groupOptions = useMemo(
    () => flattenGroups(groups).filter((g) => g.active || g.id === form.group_id),
    [groups, form.group_id]
  )
  const live = useMemo(() => validateLedger(form, { group }), [form, group])

  if (!open) return null

  const activeTab = tab === 'bank' && !form.is_bank_account ? 'details' : tab

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((f) => {
      const next = { ...f, [key]: value }
      if (key === 'opening_balance' && Number(value) > 0 && !f.effective_date) next.effective_date = currentFyStart()
      return next
    })
  }
  const setBankField = (key) => (e) => setBank((b) => ({ ...b, [key]: e.target.value }))

  const pickGroup = (e) => {
    const id = e.target.value
    const g = groups.find((x) => x.id === id)
    setForm((f) => ({
      ...f, group_id: id,
      balance_type: g && !(Number(f.opening_balance) > 0) ? NORMAL_SIDE[g.account_type] : f.balance_type
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return // blocks double submits
    setSubmitted(true)
    const { errors: found } = validateLedger(form, { group })
    const code = normalizeCode(form.ledger_code)
    if (!found.ledger_code && ledgers.some((l) => l.id !== ledger?.id && normalizeCode(l.ledger_code) === code)) {
      found.ledger_code = 'This ledger code is already in use.'
    }
    const name = form.ledger_name.trim().toLowerCase()
    if (!found.ledger_name && ledgers.some((l) => l.id !== ledger?.id && l.group_id === form.group_id && l.ledger_name.trim().toLowerCase() === name)) {
      found.ledger_name = 'A ledger with this name already exists in the same group.'
    }
    setErrors(found)

    const bankTouched = Object.entries(bank).some(([k, v]) => k !== 'account_type' && String(v || '').trim())
    const bErr = canBanking && form.is_bank_account && bankTouched ? validateBankDetails(bank) : {}
    setBankErrors(bErr)
    if (Object.keys(found).length || Object.keys(bErr).length) {
      if (Object.keys(bErr).length && !Object.keys(found).length) setTab('bank')
      else setTab('details')
      return
    }

    setSaving(true)
    try {
      let id = ledger?.id
      if (editing) await updateLedger(id, form)
      else id = (await createLedger(form)).id

      if (canBanking) {
        if (form.is_bank_account && bankTouched) await saveBankDetails(id, bank)
        else if (!form.is_bank_account && hadBank) await removeBankDetails(id)
      }
      toast.success(editing ? 'Ledger updated' : 'Ledger created')
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [['details', 'Details']]
  if (form.is_bank_account) tabs.push(['bank', 'Bank account'])
  if (editing && canAudit) tabs.push(['history', 'History'])

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy-900/50 p-4">
      <div className="card bg-white flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden !p-0">
        <div className="flex items-center justify-between bg-navy px-5 py-3">
          <h3 className="text-sm font-semibold text-white">
            Ledger <span className="font-normal text-white/60">- {viewOnly ? 'View' : editing ? 'Edit' : 'New'}</span>
          </h3>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close"><X size={18} /></button>
        </div>

        {tabs.length > 1 && (
          <div className="flex gap-1 border-b border-navy-100 px-4 pt-2">
            {tabs.map(([k, t]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === k ? 'border-gold text-navy' : 'border-transparent text-navy-400 hover:text-navy'}`}
              >{t}</button>
            ))}
          </div>
        )}

        {activeTab === 'history' ? (
          <div className="flex-1 overflow-y-auto"><AuditHistory table="chart_of_accounts" recordId={ledger.id} /></div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <fieldset disabled={viewOnly || saving} className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
              {activeTab === 'details' && (
                <>
                  <Section title="Ledger">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Ledger code *" error={errors.ledger_code}>
                        <input className="input" value={form.ledger_code} onChange={set('ledger_code')} disabled={viewOnly || saving || Boolean(ledger?.is_system)} />
                      </Field>
                      <Field label="Ledger name *" error={errors.ledger_name}>
                        <input className="input" value={form.ledger_name} onChange={set('ledger_name')} />
                      </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Parent group *"
                        error={errors.group_id}
                        hint={group ? `${group.account_type} account. ${groupPath(groups, group.id)}` : undefined}
                      >
                        <select className="input" value={form.group_id} onChange={pickGroup} disabled={viewOnly || saving || Boolean(ledger?.is_system)}>
                          <option value="">Select a group</option>
                          {groupOptions.map((g) => (
                            <option key={g.id} value={g.id}>{'\u00A0\u00A0'.repeat(g.depth)}{g.name}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Account subgroup">
                        <input className="input" value={form.account_subgroup} onChange={set('account_subgroup')} placeholder="Optional, e.g. Office rent" />
                      </Field>
                    </div>
                  </Section>

                  <Section title={`Opening balance (financial year ${fyLabel()})`}>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Amount (Rs.)" error={errors.opening_balance}>
                        <input type="number" min="0" step="0.01" className="input" value={form.opening_balance} onChange={set('opening_balance')} />
                      </Field>
                      <Field label="Debit / Credit" error={errors.balance_type}>
                        <select className="input" value={form.balance_type} onChange={set('balance_type')}>
                          <option>Debit</option>
                          <option>Credit</option>
                        </select>
                      </Field>
                      <Field label="Effective date" error={errors.effective_date}>
                        <input type="date" className="input" value={form.effective_date} onChange={set('effective_date')} />
                      </Field>
                    </div>
                    {live.warnings.length > 0 && !viewOnly && (
                      <div className="flex items-start gap-2 rounded-lg bg-gold-50 px-3 py-2 text-xs text-gold-600">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                        <ul className="space-y-0.5">{live.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
                      </div>
                    )}
                  </Section>

                  <Section title="Tax, banking and cost centre">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="flex items-center gap-2 text-sm text-navy-700">
                          <input type="checkbox" checked={form.gst_applicable} onChange={set('gst_applicable')} /> GST applicable
                        </label>
                        {form.gst_applicable && (
                          <div className="mt-2">
                            <select className="input" value={form.gst_tax_category} onChange={set('gst_tax_category')}>
                              <option value="">GST tax category</option>
                              {GST_TAX_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                            </select>
                            {errors.gst_tax_category && <p className="mt-1 text-xs text-brick">{errors.gst_tax_category}</p>}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm text-navy-700">
                          <input type="checkbox" checked={form.is_bank_account} onChange={set('is_bank_account')} /> This is a bank account
                        </label>
                        <label className="flex items-center gap-2 text-sm text-navy-700">
                          <input type="checkbox" checked={form.cost_centre_applicable} onChange={set('cost_centre_applicable')} /> Cost centre applicable
                        </label>
                        <label className="flex items-center gap-2 text-sm text-navy-700">
                          <input type="checkbox" checked={form.active} onChange={set('active')} /> Active
                        </label>
                      </div>
                    </div>
                    <Field label="Remarks" error={errors.remarks}>
                      <textarea className="input" rows={2} value={form.remarks} onChange={set('remarks')} />
                    </Field>
                  </Section>
                </>
              )}

              {activeTab === 'bank' && (
                canBanking ? (
                  <Section title="Bank account details">
                    {hadBank && !form.is_bank_account && (
                      <p className="text-xs text-brick">Saving will remove the stored bank details because this is no longer a bank ledger.</p>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Bank name" error={bankErrors.bank_name}>
                        <input className="input" value={bank.bank_name || ''} onChange={setBankField('bank_name')} />
                      </Field>
                      <Field label="Branch">
                        <input className="input" value={bank.branch_name || ''} onChange={setBankField('branch_name')} />
                      </Field>
                      <Field label="Account holder">
                        <input className="input" value={bank.account_holder || ''} onChange={setBankField('account_holder')} />
                      </Field>
                      <Field label="Account type">
                        <select className="input" value={bank.account_type || 'Current'} onChange={setBankField('account_type')}>
                          {BANK_ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Account number" error={bankErrors.account_number}>
                        <input className="input" inputMode="numeric" value={bank.account_number || ''} onChange={setBankField('account_number')} />
                      </Field>
                      <Field label="IFSC code" error={bankErrors.ifsc}>
                        <input className="input uppercase" value={bank.ifsc || ''} onChange={(e) => setBank((b) => ({ ...b, ifsc: e.target.value.toUpperCase() }))} placeholder="HDFC0001234" />
                      </Field>
                    </div>
                  </Section>
                ) : (
                  <p className="text-sm text-navy-500">Bank account numbers and IFSC codes are visible to administrators only.</p>
                )
              )}
            </fieldset>

            <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-3">
              <button type="button" className="btn-outline" onClick={onClose}>{viewOnly ? 'Close' : 'Cancel'}</button>
              {viewOnly && canWrite && (
                <button type="button" className="btn-primary" onClick={onEditRequest}><Pencil size={16} /> Edit</button>
              )}
              {!viewOnly && (
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save ledger
                </button>
              )}
            </div>
            {submitted && Object.keys(errors).length > 0 && (
              <p className="border-t border-brick-100 bg-brick-50 px-5 py-2 text-xs text-brick">Please fix the highlighted fields.</p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
