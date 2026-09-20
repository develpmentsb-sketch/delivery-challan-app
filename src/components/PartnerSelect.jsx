import React, { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'

/**
 * Searchable Vendor dropdown.
 * `partners` is the (already company-filtered) list; text filtering happens client-side.
 */
export default function PartnerSelect({ partners, value, onChange, placeholder = 'Search vendor...' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  const selected = partners.find((p) => p.id === value)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = partners.filter((p) => {
    const q = query.toLowerCase()
    return !q || p.name.toLowerCase().includes(q) || p.gstin?.toLowerCase().includes(q) || p.short_name?.toLowerCase().includes(q)
  })

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="input flex items-center justify-between text-left"
      >
        <span className={selected ? 'text-navy-800' : 'text-navy-300'}>
          {selected ? `${selected.name}${selected.gstin ? ' · ' + selected.gstin : ''}` : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <X
              size={14}
              className="text-navy-300 hover:text-brick"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
            />
          )}
          <ChevronDown size={14} className="text-navy-300" />
        </span>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full card p-2 max-h-72 overflow-y-auto">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-2.5 text-navy-300" />
            <input
              autoFocus
              className="input pl-8 py-1.5 text-sm"
              placeholder="Type name or GSTIN..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {filtered.length === 0 && <p className="text-xs text-navy-400 px-2 py-3 text-center">No vendors found for this company</p>}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.id); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gold-50 text-sm"
            >
              <span className="font-medium text-navy-800">{p.name}</span>
              <span className="block text-xs text-navy-400">{p.gstin || 'No GSTIN'} &middot; {p.bill_to_state || '-'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
