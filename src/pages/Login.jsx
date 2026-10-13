import React, { useState } from 'react'
import { Mail, Lock, Loader2, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { signIn, signUp, signInWithOAuth, resetPassword } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(false)

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

  const handleOAuth = async () => {
    setOauthLoading(true)
    try {
      const { error } = await signInWithOAuth('google')
      if (error) throw error
    } catch (err) {
      toast.error(err.message || 'Could not sign in')
      setOauthLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center overflow-hidden bg-navy-900 px-4 md:px-[8%] py-4">
      <SecurityBackdrop />
      <div className="relative z-10 w-full max-w-3xl rounded-[2rem] bg-cream-100 shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Left: welcome / brand panel */}
        <div className="relative w-full md:w-[42%] bg-navy overflow-hidden px-8 py-10 flex flex-col justify-center min-h-[220px] md:min-h-[460px]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-navy-400/70" />
            <div className="absolute bottom-10 left-28 w-24 h-24 rounded-full bg-navy-300/60" />
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-navy-400/40" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-extrabold text-white tracking-wide">WELCOME</h2>
            <p className="text-gold-400 font-semibold text-sm tracking-wide mt-1">DELIVERY CHALLAN &amp; E-WAY BILL</p>
            <p className="text-white/60 text-xs mt-4 max-w-[220px]">
              Manage your challans, e-way bills and stock ledger from one simple dashboard.
            </p>
          </div>
        </div>

        {/* Right: form panel */}
        <div className="relative w-full md:w-[58%] px-8 py-10 flex flex-col justify-center">
          <h1 className="text-2xl font-bold text-navy mb-1">
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
          </h1>
          <p className="text-xs text-navy-400 mb-6">
            {mode === 'signin' && 'Enter your details to access your dashboard.'}
            {mode === 'signup' && 'Create an account to get started.'}
            {mode === 'forgot' && "Enter your email and we'll send a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
              <input
                className="input pl-9"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-300" />
                <input
                  className="input pl-9 pr-16"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-navy-400 hover:text-navy-700 uppercase tracking-wide"
                  tabIndex={-1}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-1.5 text-navy-500">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-navy-200" />
                  Remember me
                </label>
                <button type="button" onClick={() => setMode('forgot')} className="text-gold-600 hover:text-gold-500 font-medium">
                  Forgot Password?
                </button>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5 mt-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-navy-100" />
                <span className="text-[11px] text-navy-300">Or</span>
                <div className="h-px flex-1 bg-navy-100" />
              </div>
              <button
                type="button"
                onClick={handleOAuth}
                disabled={oauthLoading}
                className="btn-outline w-full !py-2.5 justify-center disabled:opacity-50"
              >
                {oauthLoading ? <Loader2 size={16} className="animate-spin" /> : 'Sign in with Google'}
              </button>
            </>
          )}

          <p className="text-xs text-navy-400 mt-6 text-center">
            {mode === 'forgot' ? (
              <button onClick={() => setMode('signin')} className="text-navy-700 font-semibold hover:text-navy">Back to Sign In</button>
            ) : mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-navy-700 font-semibold hover:text-navy">Sign Up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('signin')} className="text-navy-700 font-semibold hover:text-navy">Sign In</button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

// Dark navy "security tech" backdrop: concentric circuit rings + a glowing
// shield-lock, echoing a security/compliance visual without using a stock photo.
function SecurityBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_50%,_rgba(59,140,240,0.22)_0%,_transparent_60%)]" />

      <svg
        className="absolute top-1/2 right-[8%] -translate-y-1/2 w-[34rem] h-[34rem] text-[#3B8CF0]/60 hidden md:block"
        viewBox="0 0 400 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {[50, 85, 120, 155, 190].map((r) => (
          <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1" opacity={r === 190 ? 0.9 : 0.5} />
        ))}
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 22.5 * Math.PI) / 180
          const x1 = 200 + 95 * Math.cos(angle)
          const y1 = 200 + 95 * Math.sin(angle)
          const x2 = 200 + 195 * Math.cos(angle)
          const y2 = 200 + 195 * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
        })}
        <rect x="130" y="130" width="140" height="140" stroke="currentColor" strokeWidth="1.25" opacity="0.7" transform="rotate(15 200 200)" />
        <rect x="150" y="150" width="100" height="100" stroke="currentColor" strokeWidth="1.25" opacity="0.8" transform="rotate(-12 200 200)" />
        {/* small tick marks around the outer ring, radar-style */}
        {Array.from({ length: 48 }).map((_, i) => {
          const angle = (i * 7.5 * Math.PI) / 180
          const x1 = 200 + 188 * Math.cos(angle)
          const y1 = 200 + 188 * Math.sin(angle)
          const x2 = 200 + 196 * Math.cos(angle)
          const y2 = 200 + 196 * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" opacity="0.6" />
        })}
      </svg>

      {/* glowing shield + lock, centered on the rings */}
      <div className="absolute top-1/2 right-[8%] -translate-y-1/2 w-28 h-28 hidden md:flex items-center justify-center">
        <div className="absolute w-40 h-40 rounded-full bg-[#5AA7FF]/40 blur-3xl" />
        <div className="absolute w-16 h-16 rounded-full bg-white/70 blur-xl" />
        <Shield size={56} className="relative text-[#BFE0FF] drop-shadow-[0_0_18px_rgba(140,200,255,0.9)]" strokeWidth={1.25} />
        <Lock size={22} className="absolute text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]" strokeWidth={2} />
      </div>

      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-navy-500/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-10 w-80 h-80 rounded-full bg-navy-600/30 blur-3xl" />
    </div>
  )
}
