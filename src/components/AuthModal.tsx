'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

interface Props {
  onClose: () => void
  defaultMode?: 'login' | 'register'
}

export default function AuthModal({ onClose, defaultMode = 'login' }: Props) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setLoading(true)
    let err: string | null
    if (mode === 'login') {
      err = await login(email, password)
    } else {
      err = await register(email, password, name, handle)
    }
    setLoading(false)
    if (err) setError(err)
    else onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-md shadow-2xl animate-fadeUp overflow-hidden">
        {/* Header */}
        <div className="bg-ink px-8 py-6 relative">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />
          <h2 className="font-serif text-2xl font-black text-paper">
            Vera<span className="text-rust2">cast</span>
          </h2>
          <p className="text-stone-400 text-xs mt-1 font-mono tracking-wide">Post it. Prove it. Spread it.</p>
        </div>

        <div className="p-8">
          {/* Mode tabs */}
          <div className="flex gap-0 mb-6 border border-stone-200 rounded-lg overflow-hidden">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2 text-sm font-semibold transition-all ${mode === m ? 'bg-ink text-paper' : 'bg-transparent text-stone-500 hover:text-stone-700'}`}
              >
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 mb-1 block">Handle</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">@</span>
                    <input
                      type="text"
                      className="w-full border border-stone-200 rounded-lg pl-7 pr-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors font-mono"
                      placeholder="janedoe"
                      value={handle}
                      onChange={e => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Email</label>
              <input
                type="email"
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Password</label>
              <input
                type="password"
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-5 py-3 bg-rust text-white rounded-lg font-serif font-bold text-base hover:bg-rust2 disabled:opacity-50 transition-all hover:shadow-lg"
          >
            {loading ? '…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <button onClick={onClose} className="w-full mt-2 py-2 text-sm text-stone-400 hover:text-stone-600 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
