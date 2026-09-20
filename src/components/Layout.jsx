import React, { useEffect } from 'react'
import { Hourglass } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../context/AuthContext'
import { loadCompanyProfile } from '../lib/companyProfile'

export default function Layout({ children }) {
  const { profile, isActive, signOut, user } = useAuth()

  // Load the company details saved by an admin (used on printed challans)
  useEffect(() => { if (isActive) loadCompanyProfile() }, [isActive])

  // Signed up but not approved yet (or deactivated by an admin)
  if (!isActive) {
    return (
      <div className="min-h-screen bg-cream-200 flex items-center justify-center p-6">
        <div className="card p-10 text-center max-w-md">
          <Hourglass size={32} className="mx-auto text-gold mb-3" />
          <h2 className="font-semibold text-navy mb-1">
            {profile ? 'Account inactive' : 'Setting up your account'}
          </h2>
          <p className="text-sm text-navy-400 mb-5">
            {profile
              ? 'Your account is waiting for administrator approval, or has been deactivated.'
              : 'No profile was found for this login. Please contact an administrator.'}
            {user?.email ? <><br />Signed in as {user.email}</> : null}
          </p>
          <button className="btn-outline" onClick={signOut}>Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-cream-200">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 lg:p-8">{children}</main>
    </div>
  )
}
