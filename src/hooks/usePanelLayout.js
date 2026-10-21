import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

// Keeps the position (x, y) and size (w, h) of a floating panel inside its container,
// saves it to localStorage, and offers helpers for moving / resizing / resetting it.

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi))

// Force a rectangle to be at least `min` in size and fully inside the container bounds.
function fit(r, b, min) {
  const w = clamp(Math.round(r.w), Math.min(min.w, b.w), b.w)
  const h = clamp(Math.round(r.h), Math.min(min.h, b.h), b.h)
  const x = clamp(Math.round(r.x), 0, b.w - w)
  const y = clamp(Math.round(r.y), 0, b.h - h)
  return { x, y, w, h }
}

function load(key) {
  try {
    const r = JSON.parse(localStorage.getItem(key) || 'null')
    if (r && ['x', 'y', 'w', 'h'].every((k) => Number.isFinite(r[k]))) return r
  } catch { /* storage unavailable or corrupt: use defaults */ }
  return null
}

export default function usePanelLayout({ containerRef, enabled = true, storageKey, getDefault, min }) {
  const [bounds, setBounds] = useState({ w: 0, h: 0 })
  const [rect, setRect] = useState(null)
  const boundsRef = useRef(bounds)
  const defaultRef = useRef(getDefault)
  const minRef = useRef(min)
  defaultRef.current = getDefault
  minRef.current = min
  boundsRef.current = bounds

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

  // First layout (saved or default) and re-fit whenever the container changes size.
  useLayoutEffect(() => {
    if (!bounds.w || !bounds.h) return
    setRect((prev) => fit(prev || load(storageKey) || defaultRef.current(bounds), bounds, minRef.current))
  }, [bounds, storageKey])

  // Save the layout (debounced) so it survives a refresh.
  useEffect(() => {
    if (!rect) return undefined
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(rect)) } catch { /* ignore */ }
    }, 200)
    return () => clearTimeout(t)
  }, [rect, storageKey])

  const update = useCallback((patch) => {
    setRect((prev) => (prev ? fit({ ...prev, ...patch }, boundsRef.current, minRef.current) : prev))
  }, [])

  const moveBy = useCallback((start, dx, dy) => update({ x: start.x + dx, y: start.y + dy }), [update])

  const nudge = useCallback((dx, dy) => {
    setRect((prev) => (prev ? fit({ ...prev, x: prev.x + dx, y: prev.y + dy }, boundsRef.current, minRef.current) : prev))
  }, [])

  // dir: n, s, e, w, ne, nw, se, sw. The edge opposite the one being dragged stays fixed.
  const resizeBy = useCallback((start, dir, dx, dy) => {
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
    setRect(fit({ x: left, y: top, w: right - left, h: bottom - top }, b, m))
  }, [])

  const reset = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
    setRect(fit(defaultRef.current(boundsRef.current), boundsRef.current, minRef.current))
  }, [storageKey])

  return { rect, bounds, min: minRef.current, update, moveBy, nudge, resizeBy, reset }
}
