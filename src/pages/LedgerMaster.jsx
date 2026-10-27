import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus, FolderPlus, Search, Eye, Pencil, Copy, Power, Trash2, ArrowUpDown, AlertTriangle, BookOpen
} from 'lucide-react'
import Header from '../components/Header'
import LoadingSpinner from '../components/LoadingSpinner'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import Pagination from '../components/Pagination'
import ChartOfAccounts from '../components/ledger/ChartOfAccounts'
import LedgerFormModal from '../components/ledger/LedgerFormModal'
import GroupFormModal from '../components/ledger/GroupFormModal'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import {
  listGroups, listLedgers, deleteLedger, setLedgerActive, deleteGroup, setGroupActive
} from '../services/ledgerService'
import {
  ACCOUNT_TYPES, descendantGroupIds, flattenGroups, formatAmount, formatSigned, groupPath,
  isDeleteBlocked, openingTotals, signedBalance, fyLabel
} from '../lib/ledger'

const PAGE_SIZE = 12

const TYPE_STYLE = {
  Asset: 'bg-sky-100 text-sky-700',
  Liability: 'bg-brick-50 text-brick-600',
  Equity: 'bg-indigo-100 text-indigo-700',
  Income: 'bg-forest-100 text-forest-600',
  Expense: 'bg-gold-100 text-gold-600'
}

export default function LedgerMaster() {
  const { can } = useAuth()
  const toast = useToast()
  const canWrite = can('ledgers.write')
  const canDelete = can('ledgers.delete')
  const canManageGroups = can('ledgers.groups')
  const canBanking = can('ledgers.banking')
  const canAudit = can('audit.view')

  const [groups, setGroups] = useState([])
  const [ledgers, setLedgers] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('ledgers')

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sort, setSort] = useState({ key: 'ledger_code', dir: 'asc' })
  const [page, setPage] = useState(1)

  const [ledgerModal, setLedgerModal] = useState({ open: false, mode: 'create' })
  const [groupModal, setGroupModal] = useState({ open: false })
  const [confirm, setConfirm] = useState(null) // { kind: 'deactivate'|'delete', target: 'ledger'|'group', record }
  const [blocked, setBlocked] = useState(null) // { target, record, message }

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [g, l] = await Promise.all([listGroups(), listLedgers()])
      setGroups(g)
      setLedgers(l)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const pathById = useMemo(() => new Map(groups.map((g) => [g.id, groupPath(groups, g.id)])), [groups])
  const groupOptions = useMemo(() => flattenGroups(groups), [groups])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const inGroup = groupFilter ? descendantGroupIds(groups, groupFilter) : null
    const rows = ledgers.filter((l) => {
      if (typeFilter && l.account_type !== typeFilter) return false
      if (inGroup && !inGroup.has(l.group_id)) return false
      if (statusFilter === 'active' && !l.active) return false
      if (statusFilter === 'inactive' && l.active) return false
      if (!q) return true
      return [l.ledger_code, l.ledger_name, l.account_subgroup, pathById.get(l.group_id)]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
    const value = (l) => {
      switch (sort.key) {
        case 'group': return pathById.get(l.group_id) || ''
        case 'opening': return signedBalance(l.opening_balance, l.balance_type)
        case 'active': return l.active ? 1 : 0
        default: return String(l[sort.key] || '').toLowerCase()
      }
    }
    rows.sort((a, b) => {
      const x = value(a)
      const y = value(b)
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.dir === 'asc' ? c : -c
    })
    return rows
  }, [ledgers, groups, search, typeFilter, groupFilter, statusFilter, sort, pathById])

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])
  const totals = useMemo(() => openingTotals(ledgers), [ledgers])

  const toggleSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const openCreate = (groupId = '') => setLedgerModal({ open: true, mode: 'create', defaultGroupId: groupId })
  const openView = (ledger) => setLedgerModal({ open: true, mode: 'view', ledger })
  const openEdit = (ledger) => setLedgerModal({ open: true, mode: 'edit', ledger })
  const openDuplicate = (ledger) => setLedgerModal({ open: true, mode: 'create', template: ledger })
  const closeLedgerModal = () => setLedgerModal((m) => ({ ...m, open: false }))

  const afterSave = () => {
    setLedgerModal((m) => ({ ...m, open: false }))
    setGroupModal({ open: false })
    load()
  }

  const runConfirmed = async () => {
    const c = confirm
    setConfirm(null)
    if (!c) return
    try {
      if (c.kind === 'deactivate') {
        if (c.target === 'ledger') await setLedgerActive(c.record.id, !c.record.active)
        else await setGroupActive(c.record.id, !c.record.active)
        toast.success(c.record.active ? 'Deactivated' : 'Activated')
      } else if (c.target === 'ledger') {
        await deleteLedger(c.record.id)
        toast.success('Ledger deleted')
      } else {
        await deleteGroup(c.record.id)
        toast.success('Group deleted')
      }
      load()
    } catch (err) {
      if (c.kind === 'delete' && isDeleteBlocked(err)) {
        setBlocked({ target: c.target, record: c.record, message: err.message })
      } else {
        toast.error(err.message)
      }
    }
  }

  const deactivateInstead = async () => {
    const b = blocked
    setBlocked(null)
    if (!b || !b.record.active) return
    try {
      if (b.target === 'ledger') await setLedgerActive(b.record.id, false)
      else await setGroupActive(b.record.id, false)
      toast.success('Deactivated')
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  const sortHead = (k, children, right) => (
    <th className={right ? 'text-right' : ''} aria-sort={sort.key === k ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-gold-100">
        {children}
        <ArrowUpDown size={12} className={sort.key === k ? 'opacity-100' : 'opacity-40'} />
      </button>
    </th>
  )

  const confirmCopy = () => {
    if (!confirm) return {}
    const name = confirm.target === 'ledger' ? confirm.record.ledger_name : confirm.record.name
    if (confirm.kind === 'delete') {
      return {
        title: `Delete ${confirm.target}?`,
        message: `"${name}" will be deleted permanently. If it is already in use you will be offered deactivation instead.`,
        confirmLabel: 'Delete',
        danger: true
      }
    }
    return confirm.record.active
      ? { title: `Deactivate ${confirm.target}?`, message: `"${name}" will no longer be offered for new entries. Existing records are not changed.`, confirmLabel: 'Deactivate', danger: true }
      : { title: `Activate ${confirm.target}?`, message: `"${name}" will be available again.`, confirmLabel: 'Activate', danger: false }
  }

  return (
    <div>
      <Header
        title="Ledger Master"
        subtitle="Ledgers are the accounts you post to. They sit under account groups in the chart of accounts."
        actions={
          <>
            {canManageGroups && (
              <button className="btn-outline" onClick={() => setGroupModal({ open: true, group: null, parentId: '' })}>
                <FolderPlus size={16} /> New group
              </button>
            )}
            {canWrite && <button className="btn-gold" onClick={() => openCreate()}><Plus size={16} /> New ledger</button>}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Ledgers', ledgers.length],
          ['Active ledgers', ledgers.filter((l) => l.active).length],
          ['Account groups', groups.length],
          [`Opening Dr / Cr (FY ${fyLabel()})`, `${formatAmount(totals.debit)} / ${formatAmount(totals.credit)}`]
        ].map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs font-semibold text-navy-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-navy">{loading ? '...' : value}</p>
          </div>
        ))}
      </div>

      {!loading && ledgers.length > 0 && totals.difference !== 0 && (
        <div className="card mb-6 flex items-start gap-3 border-gold-400 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-sm text-navy-700">
            Opening balances do not tally yet: {totals.difference > 0 ? 'debits exceed credits' : 'credits exceed debits'} by {formatAmount(Math.abs(totals.difference))}.
            They should balance once every ledger&apos;s opening balance has been entered.
          </p>
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-navy-200">
        {[['ledgers', 'Ledgers'], ['chart', 'Chart of accounts']].map(([k, t]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-gold text-navy' : 'border-transparent text-navy-400 hover:text-navy'}`}
          >{t}</button>
        ))}
      </div>

      {loadError ? (
        <div className="card p-6">
          <p className="text-sm text-brick">{loadError}</p>
          <button className="btn-outline mt-3" onClick={load}>Try again</button>
        </div>
      ) : loading ? (
        <div className="card"><LoadingSpinner /></div>
      ) : tab === 'chart' ? (
        <div className="card">
          <ChartOfAccounts
            groups={groups}
            ledgers={ledgers}
            canWriteLedgers={canWrite}
            canDeleteLedgers={canDelete}
            canManageGroups={canManageGroups}
            onAddLedger={openCreate}
            onViewLedger={openView}
            onEditLedger={openEdit}
            onDeleteLedger={(l) => setConfirm({ kind: 'delete', target: 'ledger', record: l })}
            onAddGroup={(parentId) => setGroupModal({ open: true, group: null, parentId })}
            onEditGroup={(g) => setGroupModal({ open: true, group: g, parentId: '' })}
            onDeleteGroup={(g) => setConfirm({ kind: 'delete', target: 'group', record: g })}
          />
        </div>
      ) : (
        <>
          <div className="card mb-4 grid gap-3 p-4 md:grid-cols-4">
            <div className="relative md:col-span-1">
              <Search size={14} className="absolute left-3 top-3 text-navy-300" />
              <input
                className="input pl-8"
                placeholder="Search code, name or group..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                aria-label="Search ledgers"
              />
            </div>
            <select className="input" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} aria-label="Filter by account type">
              <option value="">All account types</option>
              {ACCOUNT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <select className="input" value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }} aria-label="Filter by group">
              <option value="">All groups</option>
              {groupOptions.map((g) => <option key={g.id} value={g.id}>{'\u00A0\u00A0'.repeat(g.depth)}{g.name}</option>)}
            </select>
            <select className="input" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} aria-label="Filter by status">
              <option value="">Active and inactive</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>

          <div className="card">
            {filtered.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={ledgers.length ? 'No ledgers match these filters' : 'No ledgers yet'}
                description={ledgers.length ? 'Clear the search or filters to see all ledgers.' : 'Create your first ledger, for example Cash, a bank account or Sales.'}
                action={canWrite && !ledgers.length ? <button className="btn-primary mt-2" onClick={() => openCreate()}><Plus size={16} /> New ledger</button> : null}
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        {sortHead('ledger_code', 'Code')}
                        {sortHead('ledger_name', 'Ledger name')}
                        {sortHead('group', 'Group')}
                        {sortHead('account_type', 'Type')}
                        {sortHead('opening', 'Opening balance', true)}
                        {sortHead('active', 'Status')}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((l) => (
                        <tr key={l.id}>
                          <td className="font-mono text-xs font-semibold text-navy">{l.ledger_code}</td>
                          <td>
                            <button type="button" className="text-left font-medium text-navy hover:underline" onClick={() => openView(l)}>{l.ledger_name}</button>
                            {l.is_bank_account && <span className="badge ml-2 bg-sky-100 text-sky-700">Bank</span>}
                          </td>
                          <td className="text-navy-500">{groupById.get(l.group_id)?.name || '-'}</td>
                          <td><span className={`badge ${TYPE_STYLE[l.account_type]}`}>{l.account_type}</span></td>
                          <td className="text-right tabular-nums">{formatSigned(signedBalance(l.opening_balance, l.balance_type))}</td>
                          <td><span className={`badge ${l.active ? 'bg-forest-100 text-forest-600' : 'bg-navy-100 text-navy-500'}`}>{l.active ? 'Active' : 'Inactive'}</span></td>
                          <td>
                            <div className="flex gap-1.5">
                              <button title="View" aria-label="View" onClick={() => openView(l)} className="text-navy-400 hover:text-navy"><Eye size={15} /></button>
                              {canWrite && <button title="Edit" aria-label="Edit" onClick={() => openEdit(l)} className="text-navy-400 hover:text-navy"><Pencil size={15} /></button>}
                              {canWrite && <button title="Duplicate" aria-label="Duplicate" onClick={() => openDuplicate(l)} className="text-navy-400 hover:text-navy"><Copy size={15} /></button>}
                              {canWrite && (
                                <button
                                  title={l.active ? 'Deactivate' : 'Activate'}
                                  aria-label={l.active ? 'Deactivate' : 'Activate'}
                                  onClick={() => setConfirm({ kind: 'deactivate', target: 'ledger', record: l })}
                                  className={l.active ? 'text-navy-400 hover:text-gold' : 'text-forest hover:text-forest-600'}
                                ><Power size={15} /></button>
                              )}
                              {canDelete && !l.is_system && (
                                <button title="Delete" aria-label="Delete" onClick={() => setConfirm({ kind: 'delete', target: 'ledger', record: l })} className="text-navy-400 hover:text-brick"><Trash2 size={15} /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
              </>
            )}
          </div>
        </>
      )}

      <LedgerFormModal
        open={ledgerModal.open}
        mode={ledgerModal.mode}
        ledger={ledgerModal.ledger}
        template={ledgerModal.template}
        defaultGroupId={ledgerModal.defaultGroupId}
        groups={groups}
        ledgers={ledgers}
        canBanking={canBanking}
        canAudit={canAudit}
        canWrite={canWrite}
        onClose={closeLedgerModal}
        onSaved={afterSave}
        onEditRequest={() => setLedgerModal((m) => ({ ...m, mode: 'edit' }))}
      />

      <GroupFormModal
        open={groupModal.open}
        group={groupModal.group}
        defaultParentId={groupModal.parentId}
        groups={groups}
        canAudit={canAudit}
        onClose={() => setGroupModal({ open: false })}
        onSaved={afterSave}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        {...confirmCopy()}
        onConfirm={runConfirmed}
        onCancel={() => setConfirm(null)}
      />

      <ConfirmDialog
        open={Boolean(blocked)}
        title={`This ${blocked?.target || 'record'} cannot be deleted`}
        message={blocked ? blocked.message : ''}
        confirmLabel={blocked?.record.active ? 'Deactivate instead' : 'OK'}
        onConfirm={deactivateInstead}
        onCancel={() => setBlocked(null)}
      />
    </div>
  )
}
