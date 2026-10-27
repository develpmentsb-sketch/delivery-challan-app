import React, { useEffect, useMemo, useState } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Plus, FolderPlus, Pencil, Trash2, Eye, Landmark
} from 'lucide-react'
import EmptyState from '../EmptyState'
import { buildChartTree, formatSigned, signedBalance } from '../../lib/ledger'

const TYPE_STYLE = {
  Asset: 'bg-sky-100 text-sky-700',
  Liability: 'bg-brick-50 text-brick-600',
  Equity: 'bg-indigo-100 text-indigo-700',
  Income: 'bg-forest-100 text-forest-600',
  Expense: 'bg-gold-100 text-gold-600'
}

function IconButton({ title, onClick, danger, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`rounded p-1 text-navy-400 ${danger ? 'hover:text-brick' : 'hover:text-navy'} hover:bg-navy-50`}
    >
      {children}
    </button>
  )
}

function Balance({ value }) {
  const text = formatSigned(value)
  return <span className={`tabular-nums ${text === '-' ? 'text-navy-300' : 'text-navy-700'}`}>{text}</span>
}

// The chart of accounts as an expandable tree: groups contain sub-groups and ledgers.
export default function ChartOfAccounts({
  groups, ledgers, canWriteLedgers, canManageGroups, canDeleteLedgers,
  onAddLedger, onViewLedger, onEditLedger, onDeleteLedger,
  onAddGroup, onEditGroup, onDeleteGroup
}) {
  const [showInactive, setShowInactive] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())

  const visibleGroups = useMemo(() => (showInactive ? groups : groups.filter((g) => g.active)), [groups, showInactive])
  const visibleLedgers = useMemo(() => (showInactive ? ledgers : ledgers.filter((l) => l.active)), [ledgers, showInactive])
  const tree = useMemo(() => buildChartTree(visibleGroups, visibleLedgers), [visibleGroups, visibleLedgers])

  // Open the top-level groups the first time the data arrives.
  useEffect(() => {
    setExpanded((prev) => (prev.size ? prev : new Set(groups.filter((g) => !g.parent_id).map((g) => g.id))))
  }, [groups])

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expandAll = () => setExpanded(new Set(groups.map((g) => g.id)))
  const collapseAll = () => setExpanded(new Set())

  if (!groups.length) {
    return (
      <EmptyState
        title="No account groups yet"
        description="Run supabase/add_ledger_master.sql to load the standard groups, or add your first group."
        action={canManageGroups ? <button className="btn-primary mt-2" onClick={() => onAddGroup('')}><FolderPlus size={16} /> Add group</button> : null}
      />
    )
  }

  const renderLedger = (l, depth) => (
    <div
      key={l.id}
      role="treeitem"
      className="group flex items-center gap-2 border-b border-navy-100/60 px-3 py-1.5 text-sm hover:bg-navy-50/60"
      style={{ paddingLeft: `${depth * 22 + 14}px` }}
    >
      <span className="w-4 shrink-0" />
      {l.is_bank_account ? <Landmark size={15} className="shrink-0 text-sky-600" /> : <FileText size={15} className="shrink-0 text-navy-300" />}
      <span className="w-20 shrink-0 font-mono text-xs text-navy-400">{l.ledger_code}</span>
      <button type="button" onClick={() => onViewLedger(l)} className={`min-w-0 flex-1 truncate text-left hover:underline ${l.active ? 'text-navy-800' : 'text-navy-400 line-through'}`}>
        {l.ledger_name}
      </button>
      {!l.active && <span className="badge bg-navy-100 text-navy-500">Inactive</span>}
      <span className="w-36 shrink-0 text-right"><Balance value={signedBalance(l.opening_balance, l.balance_type)} /></span>
      <span className="flex w-28 shrink-0 justify-end gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
        <IconButton title="View ledger" onClick={() => onViewLedger(l)}><Eye size={14} /></IconButton>
        {canWriteLedgers && <IconButton title="Edit ledger" onClick={() => onEditLedger(l)}><Pencil size={14} /></IconButton>}
        {canDeleteLedgers && <IconButton title="Delete ledger" danger onClick={() => onDeleteLedger(l)}><Trash2 size={14} /></IconButton>}
      </span>
    </div>
  )

  const renderGroup = (node, depth) => {
    const g = node.group
    const open = expanded.has(g.id)
    const hasContent = node.children.length > 0 || node.ledgers.length > 0
    return (
      <div key={g.id} role="treeitem" aria-expanded={hasContent ? open : undefined}>
        <div
          className="group flex items-center gap-2 border-b border-navy-100/60 bg-navy-50/50 px-3 py-2 text-sm"
          style={{ paddingLeft: `${depth * 22 + 14}px` }}
        >
          <button
            type="button"
            onClick={() => toggle(g.id)}
            disabled={!hasContent}
            aria-label={open ? `Collapse ${g.name}` : `Expand ${g.name}`}
            className="w-4 shrink-0 text-navy-400 disabled:opacity-30"
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          {open ? <FolderOpen size={16} className="shrink-0 text-gold" /> : <Folder size={16} className="shrink-0 text-gold" />}
          <span className="w-20 shrink-0 font-mono text-xs text-navy-400">{g.code}</span>
          <span className={`min-w-0 flex-1 truncate font-semibold ${g.active ? 'text-navy' : 'text-navy-400'}`}>{g.name}</span>
          {!g.parent_id && <span className={`badge ${TYPE_STYLE[g.account_type]}`}>{g.account_type}</span>}
          {!g.active && <span className="badge bg-navy-100 text-navy-500">Inactive</span>}
          <span className="w-36 shrink-0 text-right font-semibold"><Balance value={node.total} /></span>
          <span className="flex w-28 shrink-0 justify-end gap-0.5 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
            {canWriteLedgers && g.active && <IconButton title="Add ledger here" onClick={() => onAddLedger(g.id)}><Plus size={14} /></IconButton>}
            {canManageGroups && <IconButton title="Add sub-group" onClick={() => onAddGroup(g.id)}><FolderPlus size={14} /></IconButton>}
            {canManageGroups && <IconButton title="Edit group" onClick={() => onEditGroup(g)}><Pencil size={14} /></IconButton>}
            {canManageGroups && !g.is_system && <IconButton title="Delete group" danger onClick={() => onDeleteGroup(g)}><Trash2 size={14} /></IconButton>}
          </span>
        </div>
        {open && (
          <div role="group">
            {node.children.map((c) => renderGroup(c, depth + 1))}
            {node.ledgers.map((l) => renderLedger(l, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={expandAll}>Expand all</button>
          <button type="button" className="btn-outline px-3 py-1.5 text-xs" onClick={collapseAll}>Collapse all</button>
        </div>
        <label className="flex items-center gap-2 text-sm text-navy-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive
        </label>
      </div>
      <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-500" style={{ paddingLeft: '48px' }}>
        <span className="w-20 shrink-0">Code</span>
        <span className="flex-1">Group / ledger</span>
        <span className="w-36 text-right">Opening balance</span>
        <span className="w-28" />
      </div>
      <div role="tree" className="overflow-x-auto">
        <div className="min-w-[640px]">{tree.map((n) => renderGroup(n, 0))}</div>
      </div>
      <p className="px-4 py-3 text-xs text-navy-400">
        Group totals add up the opening balances of every ledger beneath them. Entries are posted to ledgers only, never to groups.
      </p>
    </div>
  )
}
