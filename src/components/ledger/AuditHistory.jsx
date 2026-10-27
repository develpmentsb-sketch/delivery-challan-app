import React, { useEffect, useState } from 'react'
import LoadingSpinner from '../LoadingSpinner'
import EmptyState from '../EmptyState'
import { listAudit } from '../../services/ledgerService'

const SKIP = new Set(['updated_at', 'created_at', 'created_by', 'id'])

function label(key) {
  return key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
}

function show(v) {
  if (v === null || v === undefined || v === '') return '(empty)'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function changes(entry) {
  if (entry.action !== 'UPDATE') return []
  const oldD = entry.old_data || {}
  const newD = entry.new_data || {}
  return Object.keys(newD)
    .filter((k) => !SKIP.has(k) && JSON.stringify(oldD[k]) !== JSON.stringify(newD[k]))
    .map((k) => ({ key: k, from: oldD[k], to: newD[k] }))
}

const ACTION_STYLE = {
  INSERT: 'bg-forest-100 text-forest-600',
  UPDATE: 'bg-gold-100 text-gold-600',
  DELETE: 'bg-brick-100 text-brick-600'
}
const ACTION_TEXT = { INSERT: 'Created', UPDATE: 'Changed', DELETE: 'Deleted' }

// Who created / changed / deleted a record, and what changed. Only admins can read the log.
export default function AuditHistory({ table, recordId }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setRows(null)
    listAudit(table, recordId)
      .then((d) => { if (alive) setRows(d) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [table, recordId])

  if (error) return <p className="p-5 text-sm text-brick">{error}</p>
  if (!rows) return <LoadingSpinner label="Loading history..." />
  if (!rows.length) {
    return <EmptyState title="No history yet" description="Changes made from now on will be listed here." />
  }

  return (
    <ol className="space-y-3 p-5">
      {rows.map((e) => {
        const diff = changes(e)
        return (
          <li key={e.id} className="rounded-lg border border-navy-100 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`badge ${ACTION_STYLE[e.action]}`}>{ACTION_TEXT[e.action]}</span>
              <span className="text-navy-700">{e.changed_by_email || 'Unknown user'}</span>
              <span className="text-xs text-navy-400">{new Date(e.changed_at).toLocaleString('en-IN')}</span>
            </div>
            {diff.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-navy-600">
                {diff.map((c) => (
                  <li key={c.key}>
                    <span className="font-semibold">{label(c.key)}:</span> {show(c.from)} <span className="text-navy-300">to</span> {show(c.to)}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ol>
  )
}
