import React, { useRef, useState } from 'react'

// A glass panel that can be dragged and resized with the mouse (or a finger) inside its
// position: relative container. It uses pointer events, so mouse, pen and touch all work.
//  - Press and hold on any empty part of the card (not on a field / button / link) and drag it.
//  - Drag the grip bar at the top (also works for touch screens).
//  - Drag an edge or a corner to resize.
// The form inside keeps working normally: clicks on inputs, buttons and links never start a drag.
// `editMode` only adds a visible outline and handles (and the X / Y / W / H controls elsewhere).

const HANDLES = [
  // [direction, classes]
  ['n', 'left-5 right-5 top-0 h-2.5 cursor-ns-resize'],
  ['s', 'left-5 right-5 bottom-0 h-2.5 cursor-ns-resize'],
  ['w', 'top-5 bottom-5 left-0 w-2.5 cursor-ew-resize'],
  ['e', 'top-5 bottom-5 right-0 w-2.5 cursor-ew-resize'],
  ['nw', 'left-0 top-0 h-5 w-5 cursor-nwse-resize'],
  ['ne', 'right-0 top-0 h-5 w-5 cursor-nesw-resize'],
  ['sw', 'bottom-0 left-0 h-5 w-5 cursor-nesw-resize'],
  ['se', 'bottom-0 right-0 h-5 w-5 cursor-nwse-resize']
]

const INTERACTIVE = 'input,button,a,label,select,textarea,[data-no-drag]'

export default function DraggablePanel({ layout, editMode, children }) {
  const { rect, moveBy, resizeBy } = layout
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
      if (mode === 'move' && e.target.closest && e.target.closest(INTERACTIVE)) return
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
      {/* The glass card: drag it from any empty spot */}
      <div
        {...bind('move')}
        className={`h-full w-full select-none overflow-hidden rounded-3xl border bg-[rgba(15,26,53,0.35)] shadow-2xl backdrop-blur-xl ${
          active ? 'cursor-grabbing' : 'cursor-grab'
        } ${editMode ? 'border-dashed border-gold-400' : 'border-white/25'}`}
      >
        <div className="h-full overflow-y-auto px-6 pb-7 pt-9 sm:px-9 sm:pb-9 sm:pt-11">{children}</div>
      </div>

      {/* Grip bar (works for touch too) */}
      <div
        {...bind('move')}
        className={`absolute left-1/2 top-2 z-10 flex h-6 w-20 -translate-x-1/2 touch-none items-center justify-center ${
          active ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        title="Drag to move"
      >
        <span className="h-1 w-10 rounded-full bg-white/45" />
      </div>

      {/* Resize handles: edges and corners (dots show on hover, or always in edit mode) */}
      {HANDLES.map(([dir, cls]) => (
        <div key={dir} {...bind(dir)} className={`group absolute z-10 touch-none ${cls}`}>
          {dir.length === 2 && (
            <span
              className={`absolute inset-1 rounded-full border-2 border-gold-400 bg-white shadow transition-opacity ${
                editMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}
