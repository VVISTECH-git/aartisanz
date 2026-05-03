import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem('rememberedEmail') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('rememberedEmail'))
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    if (rememberMe) localStorage.setItem('rememberedEmail', email)
    else localStorage.removeItem('rememberedEmail')
    try {
      const { error } = await signIn(email, password)
      if (error) { toast.error(error.message); setLoading(false); return }

      // Get profile to determine role
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      if (profile?.role === 'admin') navigate('/admin')
      else navigate('/supplier')
    } catch (err) {
      toast.error('Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-50 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <svg width="100%" height="100%">
          <pattern id="lotus" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <ellipse cx="30" cy="30" rx="3" ry="12" fill="#8B4513"/>
            <ellipse cx="30" cy="30" rx="6" ry="8" fill="#8B4513" opacity="0.6"/>
            <ellipse cx="22" cy="31" rx="4" ry="7" fill="#8B4513" opacity="0.5"/>
            <ellipse cx="38" cy="31" rx="4" ry="7" fill="#8B4513" opacity="0.5"/>
          </pattern>
          <rect width="100%" height="100%" fill="url(#lotus)"/>
        </svg>
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden">
          {/* Header */}
          <div className="bg-brand-800 px-8 py-10 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-3xl font-heading font-bold">A</span>
            </div>
            <h1 className="font-heading text-white text-2xl font-bold">aartisanz</h1>
            <p className="text-brand-200 text-sm font-body mt-1">Supplier & Admin Portal</p>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="font-heading text-gray-900 text-xl font-semibold mb-6">Welcome back</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 accent-brand-800 cursor-pointer"
                />
                <label htmlFor="rememberMe" className="text-sm text-gray-600 font-body cursor-pointer select-none">Remember me</label>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
                {loading ? <><Loader2 size={16} className="animate-spin" /> Signing in...</> : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-6 font-body">
              Contact admin to get access · aartisanz.com
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
