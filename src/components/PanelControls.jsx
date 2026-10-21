import React, { useState } from 'react'
import { Move, Check, RotateCcw } from 'lucide-react'

// "Edit layout" toggle (top-right) plus, in edit mode, a small box to set X / Y / width / height exactly.

function NumberField({ label, value, onCommit }) {
  const [draft, setDraft] = useState(null)
  return (
    <label className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-white/70">
      {label}
      <input
        type="number"
        inputMode="numeric"
        className="w-20 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-sm font-medium normal-case text-white focus:border-gold-400 focus:outline-none"
        value={draft ?? value}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onCommit(n)
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}

export default function PanelControls({ layout, editMode, onToggle }) {
  const { rect, bounds, update, reset } = layout
  // Keep the controls box on the opposite side from the panel so it never covers it.
  const side = rect && rect.x + rect.w / 2 > bounds.w / 2 ? 'left-4' : 'right-4'
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        className={`absolute right-4 top-4 z-40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur transition-colors ${
          editMode
            ? 'border-gold-400 bg-gold-400 text-navy'
            : 'border-white/30 bg-[rgba(15,26,53,0.55)] text-white hover:bg-[rgba(15,26,53,0.75)]'
        }`}
        aria-pressed={editMode}
      >
        {editMode ? <Check size={14} /> : <Move size={14} />}
        {editMode ? 'Done' : 'Edit layout'}
      </button>

      {editMode && rect && (
        <div className={`absolute bottom-4 ${side} z-40 w-[min(17rem,calc(100%-2rem))] rounded-2xl border border-white/25 bg-[rgba(15,26,53,0.85)] p-4 shadow-2xl backdrop-blur-xl`}>
          <p className="mb-3 text-xs font-semibold text-white">Panel position &amp; size</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberField label="X" value={rect.x} onCommit={(n) => update({ x: n })} />
            <NumberField label="Y" value={rect.y} onCommit={(n) => update({ y: n })} />
            <NumberField label="W" value={rect.w} onCommit={(n) => update({ w: n })} />
            <NumberField label="H" value={rect.h} onCommit={(n) => update({ h: n })} />
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
          >
            <RotateCcw size={13} /> Reset to default
          </button>
          <p className="mt-2 text-[10px] leading-snug text-white/55">Layout is saved automatically in this browser.</p>
        </div>
      )}
    </>
  )
}
