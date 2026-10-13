import React, { useState } from 'react'
import { Truck, Loader2, Eye, EyeOff, TrendingUp, Package, FileCheck } from 'lucide-react'
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
    } catch (err) {
      toast.error(err.message || `Could not sign in with ${provider}`)
      setOauthLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex bg-cream-200">
      {/* Left: form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-20 py-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-lg bg-gold flex items-center justify-center text-navy-900">
              <Truck size={18} />
            </div>
            <span className="font-display font-bold text-navy">Delivery Challan</span>
          </div>

          <h1 className="text-2xl font-bold text-navy mb-1">
            {mode === 'signin' ? 'Log in to your account' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
          </h1>
          <p className="text-sm text-navy-400 mb-7">
            {mode === 'signin' && 'Enter your email address and password to log in.'}
            {mode === 'signup' && 'Set up an account to access the dashboard.'}
            {mode === 'forgot' && "Enter your email and we'll send you a reset link."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
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
                {mode === 'signin' && (
                  <button type="button" onClick={() => setMode('forgot')} className="text-xs text-gold-600 hover:text-gold-500 mt-1.5">
                    Forgot password?
                  </button>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full !bg-gold !text-navy-900 hover:!bg-gold-600 !py-2.5">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {mode === 'signin' ? 'Login' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
            </button>
          </form>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-navy-100" />
                <span className="text-[11px] text-navy-300">or</span>
                <div className="h-px flex-1 bg-navy-100" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <OAuthButton label="Google" loading={oauthLoading === 'google'} onClick={() => handleOAuth('google')}>
                  <GoogleIcon className="w-4 h-4" /> Google
                </OAuthButton>
                <OAuthButton label="Facebook" loading={oauthLoading === 'facebook'} onClick={() => handleOAuth('facebook')}>
                  <FacebookIcon className="w-4 h-4" /> Facebook
                </OAuthButton>
              </div>
            </>
          )}

          <p className="text-xs text-navy-400 mt-7 text-center">
            {mode === 'forgot' ? (
              <button onClick={() => setMode('signin')} className="text-navy-600 font-semibold hover:text-navy">Back to Sign In</button>
            ) : mode === 'signin' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-navy-600 font-semibold hover:text-navy">Sign Up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('signin')} className="text-navy-600 font-semibold hover:text-navy">Sign In</button>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Right: visual panel */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-10">
        <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-navy-700 via-navy-600 to-navy-400 overflow-hidden flex flex-col justify-center px-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-gold-400/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
          </div>

          {/* floating stat cards */}
          <div className="relative mb-10 space-y-3">
            <div className="bg-white/95 rounded-xl shadow-xl p-4 w-64 backdrop-blur">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide">This Month</span>
                <TrendingUp size={14} className="text-forest-500" />
              </div>
              <div className="text-xl font-bold text-navy">142 Challans</div>
              <div className="text-[11px] text-forest-500 font-medium">+18% vs last month</div>
            </div>
            <div className="bg-white/95 rounded-xl shadow-xl p-4 w-56 ml-10 backdrop-blur">
              <div className="flex items-center gap-2 mb-1">
                <Package size={14} className="text-gold-500" />
                <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide">Stock Alerts</span>
              </div>
              <div className="text-xl font-bold text-navy">6 items low</div>
            </div>
            <div className="bg-white/95 rounded-xl shadow-xl p-4 w-60 ml-4 backdrop-blur">
              <div className="flex items-center gap-2 mb-1">
                <FileCheck size={14} className="text-navy-500" />
                <span className="text-[11px] font-semibold text-navy-400 uppercase tracking-wide">E-Way Bills</span>
              </div>
              <div className="text-xl font-bold text-navy">All compliant</div>
            </div>
          </div>

          <h2 className="relative text-2xl font-bold text-white leading-snug mb-2">
            The easiest way to manage<br />your deliveries.
          </h2>
          <p className="relative text-sm text-white/70 max-w-xs">
            Challans, e-way bills and stock, all in one dashboard built for your business.
          </p>
        </div>
      </div>
    </div>
  )
}

function OAuthButton({ children, loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-center gap-2 rounded-md border border-navy-200 bg-cream-100 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50 transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : children}
    </button>
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
