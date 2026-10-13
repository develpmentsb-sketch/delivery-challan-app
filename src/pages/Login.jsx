import React, { useState } from 'react'
import { Truck, Loader2, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const toast = useToast()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (error) throw error
      if (mode === 'signup') toast.success('Account created. Check your email to confirm, then sign in.')
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-navy-900 via-navy-700 to-navy-500 px-4">
      {/* decorative background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-navy-300/30 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-gold-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-white/10 backdrop-blur-xl shadow-2xl p-7">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-lg bg-gold flex items-center justify-center text-navy-900 mb-3 shadow-lg">
            <Truck size={24} />
          </div>
          <h1 className="text-lg font-bold text-cream-100 text-center">Delivery Challan &amp; E-Way Bill</h1>
          <p className="text-xs text-cream-300/80">{mode === 'signin' ? 'Sign in to your dashboard' : 'Create your account'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-cream-200/90 mb-1">Email</label>
            <input
              className="w-full rounded-md border border-white/20 bg-white/90 px-3 py-2 text-sm text-navy-800 placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-gold-500"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-cream-200/90 mb-1">Password</label>
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
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          className="text-xs text-cream-200/80 hover:text-cream-100 mt-4 w-full text-center"
          onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
