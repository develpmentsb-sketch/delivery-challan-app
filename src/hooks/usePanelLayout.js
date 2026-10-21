import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Keeps the position (x, y) and size (w, h) of a floating panel inside its container and offers
// helpers for moving / resizing / resetting it.
//
// `saved`    = layout loaded from the server: { fx, fy, w, h } (fx / fy are fractions of the container).
// `onChange` = called (debounced) with the new { fx, fy, w, h } after the user changes the layout.
//              Pass nothing for a read-only panel.

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

// Force a rectangle to be at least `min` in size and fully inside the container bounds.
function fit(r, b, min) {
  const w = clamp(Math.round(r.w), Math.min(min.w, b.w), b.w)
  const h = clamp(Math.round(r.h), Math.min(min.h, b.h), b.h)
  const x = clamp(Math.round(r.x), 0, b.w - w)
  const y = clamp(Math.round(r.y), 0, b.h - h)
  return { x, y, w, h }
}

const fromSaved = (s, b) => ({ x: s.fx * b.w, y: s.fy * b.h, w: s.w, h: s.h })
const toSaved = (r, b) => ({
  fx: +(r.x / b.w).toFixed(4),
  fy: +(r.y / b.h).toFixed(4),
  w: r.w,
  h: r.h
})

export default function usePanelLayout({ containerRef, enabled = true, saved, getDefault, min, minWidthForSaved = 768, onChange }) {
  const [bounds, setBounds] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState(null)
  const boundsRef = useRef(bounds)
  const defaultRef = useRef(getDefault)
  const minRef = useRef(min)
  const onChangeRef = useRef(onChange)
  const savedRef = useRef(saved)
  const dirty = useRef(false) // true once the user has changed the layout in this visit
  defaultRef.current = getDefault
  minRef.current = min
  boundsRef.current = bounds
  onChangeRef.current = onChange
  savedRef.current = saved

  const baseRect = (b) => {
    const s = savedRef.current
    return s && b.w >= minWidthForSaved ? fromSaved(s, b) : defaultRef.current(b)
  }

  // Track the container size.
  useLayoutEffect(() => {
    if (!enabled) return undefined
    const el = containerRef.current
    if (!el) return undefined
    const measure = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      setBounds((p) => (p.w === w && p.h === h ? p : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [enabled, containerRef])

  // First layout, and re-fit whenever the container changes size.
  useLayoutEffect(() => {
    if (!bounds.w || !bounds.h) return
    setRect((prev) => fit(prev || baseRect(bounds), bounds, minRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bounds])

  // The saved layout arrived (or changed) from the server: apply it unless the user is editing.
  useLayoutEffect(() => {
    const b = boundsRef.current
    if (!saved || dirty.current || !b.w || !b.h) return
    setRect(fit(baseRect(b), b, minRef.current))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved])

  // Report changes made by the user (debounced) so they can be stored.
  useEffect(() => {
    if (!rect || !dirty.current || !onChangeRef.current) return undefined
    const t = setTimeout(() => onChangeRef.current && onChangeRef.current(toSaved(rect, boundsRef.current)), 700)
    return () => clearTimeout(t)
  }, [rect])

  const apply = useCallback((fn) => {
    dirty.current = true
    setRect((prev) => (prev ? fit(fn(prev), boundsRef.current, minRef.current) : prev))
  }, [])

  const update = useCallback((patch) => apply((p) => ({ ...p, ...patch })), [apply])
  const moveBy = useCallback((start, dx, dy) => apply(() => ({ ...start, x: start.x + dx, y: start.y + dy })), [apply])

  // dir: n, s, e, w, ne, nw, se, sw. The edge opposite the one being dragged stays fixed.
  const resizeBy = useCallback((start, dir, dx, dy) => {
    apply(() => {
      const b = boundsRef.current
      const m = minRef.current
      let left = start.x
      let top = start.y
      let right = start.x + start.w
      let bottom = start.y + start.h
      if (dir.includes('e')) right = clamp(right + dx, left + m.w, b.w)
      if (dir.includes('w')) left = clamp(left + dx, 0, right - m.w)
      if (dir.includes('s')) bottom = clamp(bottom + dy, top + m.h, b.h)
      if (dir.includes('n')) top = clamp(top + dy, 0, bottom - m.h)
      return { x: left, y: top, w: right - left, h: bottom - top }
    })
  }, [apply])

  const reset = useCallback(() => apply(() => defaultRef.current(boundsRef.current)), [apply])

  return { rect, bounds, min: minRef.current, update, moveBy, resizeBy, reset }
}
