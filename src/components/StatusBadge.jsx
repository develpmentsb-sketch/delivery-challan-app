import React from 'react'

const COLORS = {
  Draft: 'bg-navy-100 text-navy-700',
  Generated: 'bg-gold-100 text-gold-600',
  Dispatched: 'bg-navy-200 text-navy-800',
  Completed: 'bg-forest-100 text-forest-600',
  Cancelled: 'bg-brick-100 text-brick-600',
  'Not Generated': 'bg-navy-100 text-navy-500',
  Pending: 'bg-gold-100 text-gold-600',
  Expired: 'bg-brick-100 text-brick-600'
}

export default function StatusBadge({ status }) {
  return <span className={`badge ${COLORS[status] || 'bg-navy-100 text-navy-600'}`}>{status}</span>
}
