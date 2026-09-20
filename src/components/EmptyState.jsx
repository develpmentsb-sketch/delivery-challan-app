import React from 'react'
import { Inbox } from 'lucide-react'

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-navy-50 flex items-center justify-center text-navy-300">
        <Icon size={26} />
      </div>
      <h3 className="text-navy-700 font-semibold">{title}</h3>
      {description && <p className="text-sm text-navy-400 max-w-sm">{description}</p>}
      {action}
    </div>
  )
}
