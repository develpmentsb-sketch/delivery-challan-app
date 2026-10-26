import React, { useEffect, useRef, useState } from 'react'

// Desktop-style menu bar (File, Edit, View ...). `menus` = [{ label, items: [...] }]
// item: { label, onClick, disabled, check, header } or the string '-' for a divider.
export default function SapMenuBar({ menus, right }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc) }
  }, [])

  return (
    <div ref={ref} className="relative flex items-center bg-[#2d4d6f] text-[13px] text-white">
      {menus.map((m, i) => (
        <div key={m.label} className="relative">
          <button
            type="button"
            className={`px-3 py-2 ${open === i ? 'bg-[#47698c]' : 'hover:bg-[#47698c]'}`}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => { if (open !== null && open !== i) setOpen(i) }}
          >
            {m.label}
          </button>
          {open === i && (
            <div className="absolute left-0 top-full z-50 max-h-[70vh] min-w-[250px] overflow-auto bg-white py-1 text-[#1d2d3e] shadow-xl">
              {m.items.map((it, k) =>
                it === '-' ? <hr key={k} className="my-1 border-navy-100" />
                : it.header ? <div key={k} className="px-4 pb-0.5 pt-2 text-[10px] font-bold uppercase text-[#2d4d6f]">{it.label}</div>
                : (
                  <button key={k} type="button" disabled={it.disabled}
                    className="block w-full px-4 py-1.5 text-left hover:bg-[#e3edf8] disabled:text-gray-400 disabled:hover:bg-transparent"
                    onClick={() => { setOpen(null); it.onClick?.() }}>
                    <span className="inline-block w-4">{it.check ? '✓' : ''}</span>{it.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
      <span className="flex-1" />
      {right && <span className="px-3 text-white/90">{right}</span>}
    </div>
  )
}
