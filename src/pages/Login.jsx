import React, { useEffect, useRef, useState } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useSearchParams } from 'react-router-dom'
import TransportBackground from '../components/TransportBackground'
import DraggablePanel from '../components/DraggablePanel'
import PanelControls from '../components/PanelControls'
import usePanelLayout from '../hooks/usePanelLayout'
import {
  fetchLoginLayout, saveLoginLayout, readCachedLoginLayout,
  fetchLoginText, saveLoginText, readCachedLoginText, DEFAULT_LOGIN_TEXT
} from '../services/appSettings'
import EditableText from '../components/EditableText'

const PANEL_MIN = { w: 300, h: 340 }

// Where the sign-in panel starts the first time (or after "Reset"): left side on wide screens,
// centred on phones / tablets.
function defaultPanelRect(b) {
  const w = Math.min(448, b.w - 24)
  const h = Math.min(480, b.h - 24)
  const x = b.w >= 768 ? Math.round(b.w * 0.09) : Math.round((b.w - w) / 2)
  const y = Math.round((b.h - h) / 2)
  return { x, y, w, h }
}

export default function Login() {
  const { signIn, signUp, resetPassword, isAdmin } = useAuth()
  // Only a signed-in admin who opens /login?layout=edit may move / resize the panel.
  const [searchParams] = useSearchParams()
  const adminEditing = isAdmin && searchParams.get('layout') === 'edit'
  const toast = useToast()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)

  // Play the opening animation every time the page loads or is refreshed
  // (it does not replay when switching between Sign In / Sign Up / Forgot Password).
  const [showIntro, setShowIntro] = useState(!adminEditing)
  const [introLeaving, setIntroLeaving] = useState(false)

  useEffect(() => {
    if (!showIntro) return
    const leaveTimer = setTimeout(() => setIntroLeaving(true), 3900)
    const hideTimer = setTimeout(() => setShowIntro(false), 4300)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(hideTimer)
    }
  }, [showIntro])

  // Sign-in panel layout: saved for everyone in the database; only an admin can change it.
  const containerRef = useRef(null)
  const [editMode, setEditMode] = useState(true) // admin: show the X / Y / W / H box
  const [saveState, setSaveState] = useState(null) // null | 'saving' | 'saved' | 'error'
  const [savedLayout, setSavedLayout] = useState(() => readCachedLoginLayout())

  useEffect(() => {
    let alive = true
    fetchLoginLayout().then((v) => { if (alive && v) setSavedLayout(v) })
    return () => { alive = false }
  }, [])

  // Sign-In panel wording (admin can edit it in place; everyone else just sees it).
  const [texts, setTexts] = useState(() => readCachedLoginText() || DEFAULT_LOGIN_TEXT)
  const textsDirty = useRef(false)
  useEffect(() => {
    let alive = true
    fetchLoginText().then((v) => { if (alive && v && !textsDirty.current) setTexts(v) })
    return () => { alive = false }
  }, [])
  const changeText = (key, value) => {
    textsDirty.current = true
    setTexts((t) => ({ ...t, [key]: value }))
  }
  useEffect(() => {
    if (!adminEditing || !textsDirty.current) return undefined
    const t = setTimeout(async () => {
      setSaveState('saving')
      try {
        await saveLoginText(texts)
        setSaveState('saved')
      } catch (err) {
        setSaveState('error')
        toast.error(err.message || 'Could not save the text')
      }
    }, 800)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, adminEditing])

  const persistLayout = async (value) => {
    setSaveState('saving')
    try {
      await saveLoginLayout(value)
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      toast.error(err.message || 'Could not save the layout')
    }
  }

  const layout = usePanelLayout({
    containerRef,
    enabled: !showIntro,
    saved: savedLayout,
    getDefault: defaultPanelRect,
    min: PANEL_MIN,
    onChange: adminEditing ? persistLayout : undefined
  })
  // Editing needs a desktop / tablet width, because the saved layout is for wide screens.
  const canEditLayout = adminEditing && layout.bounds.w >= 768

  useEffect(() => {
    if (!canEditLayout || !editMode) return undefined
    const onKey = (e) => { if (e.key === 'Escape') setEditMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canEditLayout, editMode])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email)
        if (error) throw error
        toast.success('Password reset link sent. Check your email.')
        setMode('signin')
        return
      }
      const { error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (error) throw error
      if (mode === 'signup') toast.success('Account created. Check your email to confirm, then sign in.')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (showIntro) {
    return <IntroSplash leaving={introLeaving} />
  }

  const fieldClass =
    'input pl-9 !bg-white/15 !text-white !border-white/30 placeholder:!text-white/70 focus:!border-gold-400'

  return (
    <div ref={containerRef} className="relative h-screen overflow-hidden animate-page-fade-in" style={{ height: '100dvh' }}>
      {/* Full-screen animated transport background */}
      <TransportBackground />

      {canEditLayout && (
        <PanelControls layout={layout} editMode={editMode} onToggle={() => setEditMode((v) => !v)} saveState={saveState} />
      )}

      {/* Transparent (glass) sign-in card. Admin-only: drag / resize it (open /login?layout=edit) */}
      <DraggablePanel layout={layout} editMode={canEditLayout && editMode} locked={!canEditLayout}>
        <EditableText
          value={mode === 'signin' ? texts.eyebrow : DEFAULT_LOGIN_TEXT.eyebrow}
          onChange={(v) => changeText('eyebrow', v)}
          editable={canEditLayout && mode === 'signin'}
          className="text-gold-400 font-semibold text-[11px] tracking-[0.18em] mb-2"
        />
        <EditableText
          as="h1"
          value={mode === 'signin' ? texts.title : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
          onChange={(v) => changeText('title', v)}
          editable={canEditLayout && mode === 'signin'}
          className="text-3xl font-bold text-white mb-1"
        />
        <EditableText
          value={
            mode === 'signin' ? texts.subtitle
              : mode === 'signup' ? 'Create an account to get started.'
              : "Enter your email and we'll send a reset link."
          }
          onChange={(v) => changeText('subtitle', v)}
          editable={canEditLayout && mode === 'signin'}
          multiline
          className="text-sm text-white/75 mb-7"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
            <input
              className={fieldClass}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
            />
          </div>

          {mode !== 'forgot' && (
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
              <input
                className={`${fieldClass} pr-16`}
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-white/80 hover:text-white uppercase tracking-wide"
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          )}

          {mode === 'signin' && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-1.5 text-white/80">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-white/40" />
                Remember me
              </label>
              <button type="button" onClick={() => setMode('forgot')} className="text-gold-400 hover:text-gold-300 font-medium">
                Forgot Password?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full !py-3 mt-3 !bg-gold-400 !text-navy hover:brightness-110">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-xs text-white/75 mt-7 text-center">
          {mode === 'forgot' ? (
            <button onClick={() => setMode('signin')} className="text-white font-semibold hover:underline">Back to Sign In</button>
          ) : mode === 'signin' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => setMode('signup')} className="text-white font-semibold hover:underline">Sign Up</button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => setMode('signin')} className="text-white font-semibold hover:underline">Sign In</button>
            </>
          )}
        </p>
      </DraggablePanel>
    </div>
  )
}

// Opening screen shown on every page load / refresh before the sign-in form appears.
// Step 1: the watercolor background colours fade in on their own.
// Step 2: once they are in place, the quote text animates in, line by line.
function IntroSplash({ leaving }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-cream-100 ${
        leaving ? 'animate-intro-fade-out' : ''
      }`}
    >
      {/* Step 1 - background colours fade in first (0 - 0.9s) */}
      <div className="absolute inset-0 animate-page-fade-in" style={{ animationDuration: '0.9s' }}>
        <div className="absolute top-[10%] left-[18%] w-64 h-64 rounded-full bg-sky-300/60 blur-3xl" />
        <div className="absolute bottom-[15%] left-[10%] w-56 h-56 rounded-full bg-pink-200/60 blur-3xl" />
        <div className="absolute bottom-[8%] right-[14%] w-72 h-72 rounded-full bg-teal-200/60 blur-3xl" />
        <div className="absolute top-[14%] right-[16%] w-48 h-48 rounded-full bg-sky-200/50 blur-3xl" />
      </div>

      {/* Step 2 - quote text starts only after the background is in place */}
      <div className="relative text-center leading-tight">
        <p className="text-sm tracking-[0.3em] text-navy-500 font-semibold animate-intro-text" style={{ animationDelay: '1.2s' }}>
          IF YOU
        </p>
        <p
          className="font-['Dancing_Script'] text-7xl md:text-8xl font-bold text-navy-800 -mt-1 animate-intro-text"
          style={{ animationDelay: '1.6s' }}
        >
          Believe
        </p>
        <p className="text-base tracking-[0.3em] text-navy-500 font-semibold -mt-2 animate-intro-text" style={{ animationDelay: '2.1s' }}>
          IN YOURSELF
        </p>
        <p
          className="font-['Dancing_Script'] text-6xl md:text-7xl font-bold text-navy-800 mt-2 animate-intro-text"
          style={{ animationDelay: '2.5s' }}
        >
          Anything
        </p>
        <p className="text-base tracking-[0.3em] text-navy-500 font-semibold -mt-1 animate-intro-text" style={{ animationDelay: '3s' }}>
          IS POSSIBLE
        </p>
      </div>
    </div>
  )
}
