import React, { useEffect, useState } from 'react'
import { Mail, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import TransportBackground from '../components/TransportBackground'

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)

  // Play the opening animation every time the page loads or is refreshed
  // (it does not replay when switching between Sign In / Sign Up / Forgot Password).
  const [showIntro, setShowIntro] = useState(true)
  const [introLeaving, setIntroLeaving] = useState(false)

  useEffect(() => {
    if (!showIntro) return
    const leaveTimer = setTimeout(() => setIntroLeaving(true), 3000)
    const hideTimer = setTimeout(() => setShowIntro(false), 3400)
    return () => {
      clearTimeout(leaveTimer)
      clearTimeout(hideTimer)
    }
  }, [showIntro])

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-8 animate-page-fade-in">
      {/* Full-screen animated transport background */}
      <TransportBackground />

      {/* Transparent (glass) sign-in card */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/25 bg-[rgba(15,26,53,0.35)] backdrop-blur-xl shadow-2xl px-8 py-9 sm:px-10">
        <p className="text-gold-400 font-semibold text-[11px] tracking-[0.18em] mb-2">DELIVERY CHALLAN &amp; E-WAY BILL</p>
        <h1 className="text-3xl font-bold text-white mb-1">
          {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
        </h1>
        <p className="text-sm text-white/75 mb-7">
          {mode === 'signin' && 'Enter your details to access your dashboard.'}
          {mode === 'signup' && 'Create an account to get started.'}
          {mode === 'forgot' && "Enter your email and we'll send a reset link."}
        </p>

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
      </div>
    </div>
  )
}

// Opening screen shown on every page load / refresh before the sign-in form appears.
// The watercolor-blob background shows immediately; the quote text then
// animates in on top of it, word by word.
function IntroSplash({ leaving }) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-cream-100 ${
        leaving ? 'animate-intro-fade-out' : ''
      }`}
    >
      {/* background blobs - visible immediately, no animation delay */}
      <div className="absolute inset-0">
        <div className="absolute top-[10%] left-[18%] w-64 h-64 rounded-full bg-sky-300/60 blur-3xl" />
        <div className="absolute bottom-[15%] left-[10%] w-56 h-56 rounded-full bg-pink-200/60 blur-3xl" />
        <div className="absolute bottom-[8%] right-[14%] w-72 h-72 rounded-full bg-teal-200/60 blur-3xl" />
        <div className="absolute top-[14%] right-[16%] w-48 h-48 rounded-full bg-sky-200/50 blur-3xl" />
      </div>

      {/* quote text - animates in after the background is already visible */}
      <div className="relative text-center leading-tight">
        <p className="text-sm tracking-[0.3em] text-navy-500 font-semibold animate-intro-text" style={{ animationDelay: '0.3s' }}>
          IF YOU
        </p>
        <p
          className="font-['Dancing_Script'] text-7xl md:text-8xl font-bold text-navy-800 -mt-1 animate-intro-text"
          style={{ animationDelay: '0.7s' }}
        >
          Believe
        </p>
        <p className="text-base tracking-[0.3em] text-navy-500 font-semibold -mt-2 animate-intro-text" style={{ animationDelay: '1.2s' }}>
          IN YOURSELF
        </p>
        <p
          className="font-['Dancing_Script'] text-6xl md:text-7xl font-bold text-navy-800 mt-2 animate-intro-text"
          style={{ animationDelay: '1.6s' }}
        >
          Anything
        </p>
        <p className="text-base tracking-[0.3em] text-navy-500 font-semibold -mt-1 animate-intro-text" style={{ animationDelay: '2.1s' }}>
          IS POSSIBLE
        </p>
      </div>
    </div>
  )
}
