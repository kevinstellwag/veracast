'use client'
import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { User, Post } from '@/types'

interface AdminData {
  stats: {
    totalUsers: number
    totalPosts: number
    sourcedPosts: number
    bannedUsers: number
    sourceRate: number
  }
  recentUsers: (User & { email: string })[]
  recentPosts: Post[]
  flaggedPosts: Post[]
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl border border-stone-100 p-5 shadow-sm relative overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${color}`} />
      <div className="font-serif text-3xl font-black text-stone-900">{value}</div>
      <div className="text-sm font-semibold text-stone-600 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-stone-400 mt-1">{sub}</div>}
    </div>
  )
}

export default function AdminPanel() {
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'overview' | 'users' | 'posts' | 'broadcast'>('overview')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [toast, setToast] = useState('')
  const [banReason, setBanReason] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ type: string; targetId: string; label: string } | null>(null)

  useEffect(() => {
    api.get('/api/admin').then(({ ok, data: d }) => {
      if (ok && d) setData(d)
      setLoading(false)
    })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function doAction(action: string, targetId: string, extra?: Record<string, string>) {
    setActionLoading(targetId + action)
    const { ok, data: res } = await api.post('/api/admin', { action, targetId, ...extra })
    setActionLoading(null)
    setConfirmAction(null)
    if (ok) {
      showToast(`✓ ${res?.action?.replace(/_/g, ' ')}`)
      // Refresh data
      api.get('/api/admin').then(({ ok: ok2, data: d }) => { if (ok2 && d) setData(d) })
    } else {
      showToast('✗ Action failed')
    }
  }

  async function sendBroadcast() {
    if (!broadcastMsg.trim()) return
    setActionLoading('broadcast')
    const { ok, data: res } = await api.post('/api/admin', { action: 'broadcast', targetId: broadcastMsg.trim() })
    setActionLoading(null)
    if (ok) { showToast(`✓ Broadcast sent to ${res?.recipients} users`); setBroadcastMsg('') }
  }

  if (loading) return <div className="text-center py-20 text-stone-400">Loading admin panel…</div>
  if (!data) return <div className="text-center py-20 text-red-500">Access denied or failed to load.</div>

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users',    label: '👥 Users' },
    { id: 'posts',    label: '📰 Posts' },
    { id: 'broadcast', label: '📢 Broadcast' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="bg-ink rounded-xl p-5 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-rust/20 blur-2xl pointer-events-none" />
        <div className="font-mono text-[10px] text-rust2 uppercase tracking-widest mb-1">// Admin Console</div>
        <div className="font-serif text-2xl font-black text-paper">Veracast Control Panel</div>
        <div className="text-stone-400 text-sm mt-1">Full platform management</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-all
              ${tab === t.id ? 'border-rust text-rust bg-rust/5' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Users" value={data.stats.totalUsers} color="bg-gradient-to-r from-blue-400 to-blue-600" />
            <StatCard label="Total Posts" value={data.stats.totalPosts} color="bg-gradient-to-r from-rust to-rust2" />
            <StatCard label="Source Rate" value={`${data.stats.sourceRate}%`} sub="Posts with sources" color="bg-gradient-to-r from-sage2 to-gold" />
            <StatCard label="Banned Users" value={data.stats.bannedUsers} color="bg-gradient-to-r from-stone-400 to-stone-600" />
          </div>

          {data.flaggedPosts.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="font-serif font-bold text-red-800 mb-3">⚠ Potentially Unsourced Claims ({data.flaggedPosts.length})</div>
              <div className="space-y-2">
                {data.flaggedPosts.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-start gap-3 bg-white rounded-lg px-3 py-2.5 border border-red-100">
                    <div className="flex-1 text-sm text-stone-700 line-clamp-2">{p.content}</div>
                    <button onClick={() => doAction('delete_post', p.id)}
                      className="text-xs text-red-600 hover:text-red-800 font-semibold flex-shrink-0 transition-colors">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex items-center justify-between">
              <div className="font-semibold text-sm text-stone-700">All Users ({data.recentUsers.length} most recent)</div>
            </div>
            <div className="divide-y divide-stone-100">
              {data.recentUsers.map(u => (
                <div key={u.id} className={`flex items-center gap-3 px-4 py-3 ${u.is_banned ? 'bg-red-50/50' : ''}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: u.avatar_color }}>
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-stone-900">{u.name}</span>
                      {u.is_admin && <span className="text-[9px] bg-gold/20 text-amber-700 border border-gold/30 px-1.5 py-0.5 rounded font-mono">ADMIN</span>}
                      {u.is_banned && <span className="text-[9px] bg-red-100 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-mono">BANNED</span>}
                    </div>
                    <div className="text-xs text-stone-400 font-mono">@{u.handle} · {u.email}</div>
                  </div>
                  <div className="text-xs text-stone-400 hidden md:block">{u.post_count} posts</div>
                  <div className="flex items-center gap-1.5">
                    {u.is_banned
                      ? <button onClick={() => doAction('unban_user', u.id)}
                          className="text-xs px-2.5 py-1.5 bg-sage2/15 text-sage2 border border-sage2/30 rounded font-semibold hover:bg-sage2/25 transition-colors">
                          Unban
                        </button>
                      : <button onClick={() => setConfirmAction({ type: 'ban_user', targetId: u.id, label: `Ban @${u.handle}?` })}
                          className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded font-semibold hover:bg-red-100 transition-colors">
                          Ban
                        </button>
                    }
                    {!u.is_admin
                      ? <button onClick={() => doAction('make_admin', u.id)}
                          className="text-xs px-2.5 py-1.5 bg-gold/10 text-amber-700 border border-gold/25 rounded font-semibold hover:bg-gold/20 transition-colors">
                          +Admin
                        </button>
                      : <button onClick={() => doAction('remove_admin', u.id)}
                          className="text-xs px-2.5 py-1.5 bg-stone-100 text-stone-500 border border-stone-200 rounded font-semibold hover:bg-stone-200 transition-colors">
                          -Admin
                        </button>
                    }
                    <button onClick={() => setConfirmAction({ type: 'delete_user', targetId: u.id, label: `Permanently delete @${u.handle} and all their posts? This cannot be undone.` })}
                      className="text-xs px-2.5 py-1.5 bg-stone-100 text-stone-500 border border-stone-200 rounded font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Posts */}
      {tab === 'posts' && (
        <div>
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-stone-100 bg-stone-50">
              <div className="font-semibold text-sm text-stone-700">Recent Posts ({data.recentPosts.length} most recent)</div>
            </div>
            <div className="divide-y divide-stone-100">
              {data.recentPosts.map(p => (
                <div key={p.id} className="flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ background: p.author?.avatar_color || '#888' }}>
                    {p.author?.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-stone-700">@{p.author?.handle}</span>
                      <span className="text-[9px] font-mono text-stone-400">{p.category}</span>
                      <span className="text-[9px] font-mono text-stone-400">❤ {p.like_count}</span>
                    </div>
                    <div className="text-sm text-stone-800 line-clamp-2">{p.content}</div>
                  </div>
                  <button
                    onClick={() => setConfirmAction({ type: 'delete_post', targetId: p.id, label: 'Delete this post? This cannot be undone.' })}
                    disabled={actionLoading === p.id + 'delete_post'}
                    className="text-xs px-2.5 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded font-semibold hover:bg-red-100 transition-colors flex-shrink-0 disabled:opacity-50">
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Broadcast */}
      {tab === 'broadcast' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <div className="font-serif text-lg font-bold text-stone-900 mb-1">📢 System Broadcast</div>
            <div className="text-sm text-stone-500 mb-5">Send a notification to every active user on the platform.</div>
            <textarea
              className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-rust transition-colors mb-4"
              rows={4}
              placeholder="Your message to all users…"
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              maxLength={500}
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-stone-400">{broadcastMsg.length}/500</div>
              <button onClick={sendBroadcast} disabled={!broadcastMsg.trim() || actionLoading === 'broadcast'}
                className="px-6 py-2.5 bg-rust text-white rounded-lg font-semibold text-sm hover:bg-rust2 disabled:opacity-40 transition-colors">
                {actionLoading === 'broadcast' ? 'Sending…' : 'Send to All Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-paper rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <div className="font-serif text-lg font-bold text-stone-900 mb-2">Confirm Action</div>
            <div className="text-sm text-stone-600 mb-2">{confirmAction.label}</div>
            {confirmAction.type === 'ban_user' && (
              <input type="text" placeholder="Reason (optional)"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mb-4 outline-none focus:border-rust"
                value={banReason} onChange={e => setBanReason(e.target.value)} />
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => { setConfirmAction(null); setBanReason('') }}
                className="flex-1 py-2.5 border border-stone-300 text-stone-600 rounded-lg text-sm font-semibold hover:bg-stone-100">
                Cancel
              </button>
              <button
                onClick={() => doAction(confirmAction.type, confirmAction.targetId, banReason ? { reason: banReason } : undefined)}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-paper px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xl z-50 border-l-4 border-sage2 animate-fadeUp">
          {toast}
        </div>
      )}
    </div>
  )
}
