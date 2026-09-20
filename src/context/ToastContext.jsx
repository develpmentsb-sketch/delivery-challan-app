import React, { createContext, useCallback, useContext, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, type }])
    if (duration) setTimeout(() => remove(id), duration)
  }, [remove])

  const toast = {
    success: (msg) => push(msg, 'success'),
    error: (msg) => push(msg, 'error'),
    info: (msg) => push(msg, 'info')
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`card flex items-start gap-2 px-4 py-3 border-l-4 ${
              t.type === 'success' ? 'border-l-forest' : t.type === 'error' ? 'border-l-brick' : 'border-l-navy'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 size={18} className="text-forest mt-0.5 shrink-0" />}
            {t.type === 'error' && <XCircle size={18} className="text-brick mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info size={18} className="text-navy mt-0.5 shrink-0" />}
            <p className="text-sm text-navy-800 flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-navy-300 hover:text-navy-600">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
