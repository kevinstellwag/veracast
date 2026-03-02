'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from '@/types'

interface AuthCtx {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<string | null>
  register: (email: string, password: string, name: string, handle: string) => Promise<string | null>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('vc_token')
    if (t) {
      setToken(t)
      fetchMe(t).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  async function fetchMe(t: string) {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok) {
        const { data } = await res.json()
        setUser(data)
      } else {
        localStorage.removeItem('vc_token')
        setToken(null)
        setUser(null)
      }
    } catch {
      // network error, keep token for retry
    }
  }

  async function refreshUser() {
    if (token) await fetchMe(token)
  }

  async function login(email: string, password: string): Promise<string | null> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json()
    if (!res.ok) return json.error || 'Login failed'
    localStorage.setItem('vc_token', json.data.token)
    setToken(json.data.token)
    setUser(json.data.user)
    return null
  }

  async function register(email: string, password: string, name: string, handle: string): Promise<string | null> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, handle }),
    })
    const json = await res.json()
    if (!res.ok) return json.error || 'Registration failed'
    localStorage.setItem('vc_token', json.data.token)
    setToken(json.data.token)
    setUser(json.data.user)
    return null
  }

  async function logout() {
    localStorage.removeItem('vc_token')
    setToken(null)
    setUser(null)
    await fetch('/api/auth/me', { method: 'DELETE' })
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
