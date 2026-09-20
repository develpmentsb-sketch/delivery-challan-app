import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

/**
 * Route guard. Usage in App.jsx:
 *   <Route path="/users" element={<RequirePermission perm="users.manage"><Users /></RequirePermission>} />
 */
export default function RequirePermission({ perm, children }) {
  const { can } = useAuth()
  if (can(perm)) return children
  return (
    <div className="card p-10 text-center max-w-lg mx-auto mt-10">
      <ShieldAlert size={32} className="mx-auto text-brick mb-3" />
      <h2 className="font-semibold text-navy mb-1">Access restricted</h2>
      <p className="text-sm text-navy-400">
        Your role doesn&apos;t have permission to view this page. Please contact an administrator.
      </p>
    </div>
  )
}
