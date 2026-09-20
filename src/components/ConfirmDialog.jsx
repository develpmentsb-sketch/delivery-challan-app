import React from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[90] bg-navy-900/50 flex items-center justify-center p-4">
      <div className="card w-full max-w-sm p-5">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-brick-100 text-brick-600' : 'bg-gold-100 text-gold-600'}`}>
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-navy-800">{title}</h3>
            <p className="text-sm text-navy-500 mt-1">{message}</p>
          </div>
          <button onClick={onCancel} className="text-navy-300 hover:text-navy-600">
            <X size={16} />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button className="btn-outline" onClick={onCancel}>Cancel</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
