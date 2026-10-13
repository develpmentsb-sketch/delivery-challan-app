import React, { useState } from 'react'
import { Truck, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { signIn, signUp, signInWithOAuth, resetPassword } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)

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

  const handleOAuth = async (provider) => {
    setOauthLoading(provider)
    try {
      const { error } = await signInWithOAuth(provider)
      if (error) throw error
      // On success the browser redirects away to the provider, so no further
      // state update happens here.
    } catch (err) {
      toast.error(err.message || `Could not sign in with ${provider}`)
      setOauthLoading(null)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center overflow-hidden bg-gradient-to-br from-[#0E3F91] via-[#1659C4] to-[#3B8CF0] px-4 py-10">
      {/* decorative wave / loop shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/4 right-[-6rem] w-[28rem] h-[28rem] rounded-full bg-[#0A2E6B]/40 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
        <WaveLoop className="absolute top-20 left-10 w-20 h-20 text-white/25 hidden md:block" />
        <WaveLoop className="absolute top-40 left-20 w-14 h-14 text-white/20 hidden md:block" />
        <SwirlLoop className="absolute bottom-24 left-[28%] w-40 h-40 text-white/10 hidden md:block" />
        <WaveLoop className="absolute bottom-28 right-[12%] w-16 h-16 text-white/20 hidden md:block" />
        <WaveLoop className="absolute top-1/2 right-[6%] w-12 h-12 text-white/15 hidden md:block" />
      </div>

      <div className="relative w-full max-w-sm mx-auto md:ml-[12%] md:mr-0 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl p-7">
        <div className="flex flex-col items-start mb-6">
          <div className="w-12 h-12 rounded-lg bg-gold flex items-center justify-center text-navy-900 mb-3 shadow-lg">
            <Truck size={24} />
          </div>
          <p className="text-xs font-semibold text-white/70">Delivery Challan &amp; E-Way Bill</p>
          <h1 className="text-2xl font-bold text-white">
            {mode === 'signin' ? 'Login' : mode === 'signup' ? 'Sign Up' : 'Reset Password'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/80 mb-1">Email</label>
            <input
              className="w-full rounded-md border border-white/20 bg-white/90 px-3 py-2 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-500"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-white/80">Password</label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => setMode('forgot')} className="text-xs text-gold-400 hover:text-gold-500">
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  className="w-full rounded-md border border-white/20 bg-white/90 pl-3 pr-10 py-2 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-500"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-navy-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <>
            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-white/20" />
              <span className="text-[11px] text-white/60">or continue with</span>
              <div className="h-px flex-1 bg-white/20" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <OAuthButton label="Google" loading={oauthLoading === 'google'} onClick={() => handleOAuth('google')}>
                <GoogleIcon className="w-4 h-4" />
              </OAuthButton>
              <OAuthButton label="GitHub" loading={oauthLoading === 'github'} onClick={() => handleOAuth('github')}>
                <GitHubIcon className="w-4 h-4" />
              </OAuthButton>
              <OAuthButton label="Facebook" loading={oauthLoading === 'facebook'} onClick={() => handleOAuth('facebook')}>
                <FacebookIcon className="w-4 h-4" />
              </OAuthButton>
            </div>
          </>
        )}

        <button
          className="text-xs text-white/80 hover:text-white mt-5 w-full text-center"
          onClick={() => setMode(mode === 'forgot' ? 'signin' : mode === 'signup' ? 'signin' : 'signup')}
        >
          {mode === 'forgot' ? 'Back to Sign In' : mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}

function OAuthButton({ children, label, onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={`Continue with ${label}`}
      className="flex items-center justify-center gap-1.5 rounded-md border border-white/20 bg-white/90 py-2 text-xs font-medium text-navy-700 hover:bg-white transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
  )
}

function WaveLoop({ className }) {
  return (
    <svg viewBox="0 0 100 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 30 Q 20 5, 35 30 T 65 30" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
      <path d="M35 45 Q 50 20, 65 45 T 95 45" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
    </svg>
  )
}

function SwirlLoop({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M100 40 a40 40 0 1 1 -40 -40"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
        transform="translate(10 50) rotate(-30)"
      />
    </svg>
  )
}

function GoogleIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12A11.99 11.99 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.6H1.26A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.26 5.4l4.01-3.12z" />
      <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.26 6.6l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  )
}

function GitHubIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#171515" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12c0 5.1 3.29 9.43 7.86 10.96.57.1.78-.25.78-.55v-2.12c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15v3.19c0 .31.21.66.79.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  )
}

function FacebookIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.9 18.63 1 12 1S0 5.9 0 12.07c0 5.56 4.39 10.17 10.13 10.93v-7.73H7.08v-3.2h3.05V9.41c0-2.99 1.84-4.63 4.6-4.63 1.33 0 2.73.24 2.73.24v2.9h-1.54c-1.51 0-1.98.92-1.98 1.86v2.29h3.37l-.54 3.2h-2.83V23c5.74-.76 10.13-5.37 10.13-10.93z"
      />
    </svg>
  )
}
