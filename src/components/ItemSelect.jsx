import React, { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown } from 'lucide-react'

export default function ItemSelect({ items, value, onChange, placeholder = 'Select item...' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const btnRef = useRef(null)
  const listRef = useRef(null)
  const [pos, setPos] = useState(null)

  const selected = items.find((i) => i.id === value)

  useEffect(() => {
    function onClickOutside(e) {
      const inside = ref.current?.contains(e.target) || listRef.current?.contains(e.target)
      if (!inside) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // The list is position:fixed so the table's horizontal scroll area can't clip it.
  function toggle() {
    if (open) return setOpen(false)
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const below = window.innerHeight - r.bottom
      const flipUp = below < 300 && r.top > below
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 296)),
        ...(flipUp ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 })
      })
    }
    setOpen(true)
  }

  // Close when the page/table scrolls or the window resizes (the fixed list would drift)
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'scroll' && listRef.current?.contains(e.target)) return
      setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const filtered = items.filter((i) => {
    const q = query.toLowerCase()
    return !q || i.item_name.toLowerCase().includes(q) || i.item_code.toLowerCase().includes(q)
  })

  return (
    <div className="relative min-w-[180px]" ref={ref}>
      <button type="button" ref={btnRef} onClick={toggle} className="input flex items-center justify-between text-left py-1.5 text-sm">
        <span className={selected ? 'text-navy-800 truncate' : 'text-navy-300 truncate'}>
          {selected ? selected.item_name : placeholder}
        </span>
        <ChevronDown size={14} className="text-navy-300 shrink-0" />
      </button>
      {open && pos && (
        <div ref={listRef} style={{ position: 'fixed', ...pos }} className="z-50 w-72 card p-2 max-h-64 overflow-y-auto shadow-lg">
          <div className="relative mb-2">
            <Search size={14} className="absolute left-2.5 top-2.5 text-navy-300" />
            <input autoFocus className="input pl-8 py-1.5 text-sm" placeholder="Search item code or name..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {filtered.length === 0 && <p className="text-xs text-navy-400 px-2 py-3 text-center">No items found</p>}
          {filtered.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => { onChange(i); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-gold-50 text-sm"
            >
              <span className="font-medium text-navy-800">{i.item_name}</span>
              <span className="block text-xs text-navy-400">{i.item_code} &middot; HSN {i.hsn || '-'} &middot; GST {i.gst_rate}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
