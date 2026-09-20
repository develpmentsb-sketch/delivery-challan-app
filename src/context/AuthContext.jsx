import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { can as canRole } from '../lib/permissions'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  // Remember which user the loaded profile belongs to, so we never show a
  // stale role (or an "inactive" flash) while the right profile is loading.
  const [profileState, setProfileState] = useState({ uid: null, data: null })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  // Load the role/profile whenever the signed-in user changes.
  // (Done in an effect, not inside onAuthStateChange, to avoid Supabase auth deadlocks.)
  const loadProfile = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfileState({ uid: userId, data: error ? null : data })
  }, [userId])

  useEffect(() => { loadProfile() }, [loadProfile])

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp = (email, password) => supabase.auth.signUp({ email, password })
  const signOut = () => supabase.auth.signOut()
  const changePassword = (newPassword) => supabase.auth.updateUser({ password: newPassword })

  const value = useMemo(() => {
    const profileReady = !userId || profileState.uid === userId
    const profile = userId && profileState.uid === userId ? profileState.data : null
    const role = profile?.is_active ? profile.role : null
    return {
      session,
      user: session?.user || null,
      loading: authLoading || !profileReady,
      profile,
      role,
      isActive: Boolean(profile?.is_active),
      isAdmin: role === 'admin',
      can: (permission) => canRole(role, permission),
      refreshProfile: loadProfile,
      signIn, signUp, signOut, changePassword
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, authLoading, profileState, userId, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
