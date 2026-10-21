import React, { useRef, useState } from 'react'

// A glass panel that can be dragged and resized inside its (position: relative) container.
// Uses pointer events, so the same code works for mouse, pen and touch.
// While `editMode` is off the panel behaves like a normal card and its content is fully usable.

const HANDLES = [
  // [direction, classes]
  ['n', 'left-4 right-4 top-0 h-3 cursor-ns-resize'],
  ['s', 'left-4 right-4 bottom-0 h-3 cursor-ns-resize'],
  ['w', 'top-4 bottom-4 left-0 w-3 cursor-ew-resize'],
  ['e', 'top-4 bottom-4 right-0 w-3 cursor-ew-resize'],
  ['nw', 'left-0 top-0 h-5 w-5 cursor-nwse-resize'],
  ['ne', 'right-0 top-0 h-5 w-5 cursor-nesw-resize'],
  ['sw', 'bottom-0 left-0 h-5 w-5 cursor-nesw-resize'],
  ['se', 'bottom-0 right-0 h-5 w-5 cursor-nwse-resize']
]

export default function DraggablePanel({ layout, editMode, children }) {
  const { rect, moveBy, resizeBy, nudge } = layout
  const gesture = useRef(null)
  const [active, setActive] = useState(false)
  if (!rect) return null

  const end = (e) => {
    if (!gesture.current) return
    gesture.current = null
    setActive(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* already released */ }
  }

  const bind = (mode) => ({
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      gesture.current = { mode, sx: e.clientX, sy: e.clientY, start: rect }
      setActive(true)
    },
    onPointerMove: (e) => {
      const g = gesture.current
      if (!g) return
      const dx = e.clientX - g.sx
      const dy = e.clientY - g.sy
      if (g.mode === 'move') moveBy(g.start, dx, dy)
      else resizeBy(g.start, g.mode, dx, dy)
    },
    onPointerUp: end,
    onPointerCancel: end
  })

  const onKeyDown = (e) => {
    const step = e.shiftKey ? 20 : 4
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (map[e.key]) {
      e.preventDefault()
      nudge(...map[e.key])
    }
  }

  return (
    <div
      className="absolute left-0 top-0 z-10"
      style={{
        width: rect.w,
        height: rect.h,
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        transition: active ? 'none' : 'transform .22s ease, width .22s ease, height .22s ease',
        willChange: 'transform'
      }}
    >
      {/* The glass card itself */}
      <div
        className={`h-full w-full overflow-hidden rounded-3xl border bg-[rgba(15,26,53,0.35)] shadow-2xl backdrop-blur-xl ${
          editMode ? 'border-gold-400/70' : 'border-white/25'
        }`}
      >
        <div className={`h-full overflow-y-auto px-6 py-7 sm:px-9 sm:py-9 ${editMode ? 'pointer-events-none select-none' : ''}`}>
          {children}
        </div>
      </div>

      {/* Edit mode: drag surface + resize handles */}
      {editMode && (
        <>
          <div
            {...bind('move')}
            onKeyDown={onKeyDown}
            tabIndex={0}
            role="group"
            aria-label="Sign-in panel. Drag to move, or use the arrow keys."
            className={`absolute inset-0 touch-none select-none rounded-3xl border-2 border-dashed border-gold-400 bg-gold-400/5 outline-none ${
              active ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-[rgba(15,26,53,0.85)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-400">
              Drag to move
            </span>
          </div>
          {HANDLES.map(([dir, cls]) => (
            <div key={dir} {...bind(dir)} className={`absolute z-10 touch-none ${cls}`}>
              {dir.length === 2 && (
                <span className="absolute inset-1 rounded-full border-2 border-gold-400 bg-white shadow" />
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
