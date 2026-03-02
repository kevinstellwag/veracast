'use client'
import { useState, useEffect, useCallback } from 'react'
import { Post, User, Notification } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import PostCard from '@/components/PostCard'
import Compose from '@/components/Compose'
import AuthModal from '@/components/AuthModal'
import EditProfileModal from '@/components/EditProfileModal'
import ChatView from '@/components/ChatView'
import AdminPanel from '@/components/AdminPanel'

// ── Avatar ─────────────────────────────────────────────────
function Avatar({ user, size = 'md', onClick }: {
  user: { name: string; avatar_color: string; avatar_url?: string | null }
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-9 h-9 text-sm'
  if (user.avatar_url) return (
    <button onClick={onClick} className={`${sz} rounded-full overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity`}>
      <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
    </button>
  )
  return (
    <button onClick={onClick} className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 hover:opacity-80 transition-opacity`}
      style={{ background: user.avatar_color }}>
      {user.name.slice(0, 2).toUpperCase()}
    </button>
  )
}

// ── Feed loader ────────────────────────────────────────────
function useFeed(feedType: 'home' | 'following' | 'trending', active: boolean) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const load = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)
    const cur = reset ? null : cursor
    const url = `/api/posts?feed=${feedType}${cur ? `&cursor=${cur}` : ''}`
    const { ok, data } = await api.get(url)
    if (ok && data) {
      setPosts(prev => reset ? data.posts : [...prev, ...data.posts])
      setCursor(data.nextCursor)
      setHasMore(!!data.nextCursor)
    }
    setLoading(false)
  }, [feedType, cursor, loading])

  useEffect(() => {
    if (active) { setPosts([]); setCursor(null); setHasMore(true); load(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedType, active])

  return { posts, loading, hasMore, load, setPosts }
}

const TRENDING_TOPICS = [
  { tag: '#HighwayClosure', posts: '1.2K', sourced: 91 },
  { tag: '#ClimateReport',  posts: '4.8K', sourced: 87 },
  { tag: '#EUAILaw',        posts: '3.2K', sourced: 82 },
  { tag: '#Measles2026',    posts: '2.9K', sourced: 94 },
  { tag: '#InflationData',  posts: '1.9K', sourced: 79 },
  { tag: '#GPT5Release',    posts: '5.6K', sourced: 71 },
]

// ── Notifications panel ────────────────────────────────────
function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/notifications').then(({ data }) => {
      setNotifs(data?.notifications || [])
      setLoading(false)
    })
    api.post('/api/notifications', {}) // mark all read
  }, [])

  const icons: Record<string, string> = { like: '❤️', follow: '👤', mention: '💬', message: '✉️', system: '📢' }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'now'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}d`
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute right-4 top-14 w-80 bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-stone-200 bg-ink flex items-center justify-between">
          <div className="font-serif font-bold text-paper text-sm">Notifications</div>
          <button onClick={onClose} className="text-stone-400 hover:text-paper text-sm">✕</button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading
            ? <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
            : notifs.length === 0
            ? <div className="text-center py-10 text-stone-400 text-sm">
                <div className="text-3xl mb-2">🔔</div>
                No notifications yet
              </div>
            : notifs.map(n => (
                <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border-b border-stone-100 hover:bg-stone-50 ${!n.read ? 'bg-blue-50/40' : ''}`}>
                  <div className="text-lg flex-shrink-0 mt-0.5">{icons[n.type] || '🔔'}</div>
                  <div className="flex-1 min-w-0">
                    {n.actor && <span className="font-semibold text-sm">{n.actor.name} </span>}
                    <span className="text-sm text-stone-600">{n.message}</span>
                    <div className="text-[10px] text-stone-400 mt-0.5">{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                </div>
              ))
          }
        </div>
      </div>
    </div>
  )
}

// ── Profile view ───────────────────────────────────────────
function ProfileView({ handle, onAuthorClick, onBack }: {
  handle: string
  onAuthorClick: (h: string) => void
  onBack: () => void
}) {
  const { user: me, refreshUser } = useAuth()
  const [data, setData] = useState<{ user: User & { isFollowing?: boolean }; posts: Post[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'posts' | 'sourced' | 'liked'>('posts')
  const [following, setFollowing] = useState(false)
  const [showEdit, setShowEdit] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    const { ok, data: d } = await api.get(`/api/users/${handle}`)
    if (ok && d) { setData(d); setFollowing(d.user.isFollowing ?? false) }
    setLoading(false)
  }, [handle])

  useEffect(() => { loadProfile() }, [loadProfile])

  async function toggleFollow() {
    if (!data) return
    const { ok, data: res } = await api.post('/api/follow', { targetUserId: data.user.id })
    if (ok && res) { setFollowing(res.following); loadProfile() }
  }

  if (loading) return <div className="text-center py-20 text-stone-400">Loading…</div>
  if (!data) return <div className="text-center py-20 text-stone-400">User not found.</div>

  const { user, posts } = data
  const isMe = me?.id === user.id
  const shownPosts = tab === 'sourced' ? posts.filter(p => p.sources && p.sources.length > 0)
    : tab === 'liked' ? posts.filter(p => p.liked)
    : posts

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 mb-4 transition-colors">
        ← Back
      </button>

      {/* Profile header */}
      <div className="bg-ink rounded-xl overflow-hidden mb-6 shadow-sm">
        {/* Banner */}
        <div className="h-32 relative" style={{ background: user.banner_color || '#1a1916' }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(245,242,235,.3) 20px,rgba(245,242,235,.3) 21px)' }} />
        </div>

        <div className="px-6 pb-6 relative">
          <div className="absolute -top-10 left-6">
            <div className="border-4 border-ink rounded-full overflow-hidden w-20 h-20">
              {user.avatar_url
                ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl" style={{ background: user.avatar_color }}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
              }
            </div>
          </div>

          <div className="flex justify-end pt-3">
            {isMe
              ? <button onClick={() => setShowEdit(true)}
                  className="border border-stone-500 text-stone-300 text-xs font-semibold px-4 py-1.5 rounded-lg hover:border-stone-300 transition-colors">
                  Edit Profile
                </button>
              : <button onClick={toggleFollow}
                  className={`text-xs font-semibold px-5 py-1.5 rounded-lg border-2 transition-all
                    ${following ? 'bg-rust border-rust text-white hover:bg-transparent hover:text-mist hover:border-stone-500' : 'border-rust2 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}>
                  {following ? 'Following' : 'Follow'}
                </button>
            }
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-2">
              <div className="font-serif text-xl font-black text-paper">{user.name}</div>
              {user.is_admin && <span className="text-[9px] bg-gold/20 text-amber-400 border border-gold/30 px-1.5 py-0.5 rounded font-mono">ADMIN</span>}
            </div>
            <div className="font-mono text-xs text-stone-500 mt-0.5">@{user.handle}</div>
            {user.bio && <div className="text-sm text-stone-300 mt-2 leading-relaxed">{user.bio}</div>}
            <div className="flex gap-4 mt-2 flex-wrap">
              {user.location && <span className="text-xs text-stone-500 flex items-center gap-1">📍 {user.location}</span>}
              {user.website && <a href={user.website} target="_blank" rel="noopener noreferrer" className="text-xs text-rust2 hover:underline flex items-center gap-1">🔗 {user.website.replace(/https?:\/\//, '')}</a>}
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            {[['Posts', posts.length], ['Following', user.following_count], ['Followers', user.follower_count]].map(([label, val]) => (
              <div key={label as string}>
                <div className="font-serif text-lg font-bold text-paper">{val}</div>
                <div className="font-mono text-[10px] text-stone-500">{label as string}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2 border border-white/8">
            <span className="text-[10px] text-stone-500">Source rate</span>
            <div className="flex-1 h-1 bg-white/10 rounded overflow-hidden">
              <div className="h-full rounded bg-gradient-to-r from-sage2 to-gold" style={{ width: `${user.source_rate}%` }} />
            </div>
            <span className="font-mono text-[10px] text-gold font-medium">{user.source_rate}%</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-stone-200 mb-5">
        {(['posts', 'sourced', 'liked'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all capitalize
              ${tab === t ? 'border-rust text-rust' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
            {t} ({t === 'posts' ? posts.length : t === 'sourced' ? posts.filter(p => p.sources?.length).length : posts.filter(p => p.liked).length})
          </button>
        ))}
      </div>

      {shownPosts.length === 0
        ? <div className="text-center py-10 text-stone-400 text-sm">No posts here yet.</div>
        : shownPosts.map(p => <PostCard key={p.id} post={p} onAuthorClick={onAuthorClick} />)
      }

      {showEdit && isMe && me && (
        <EditProfileModal user={me} onClose={() => setShowEdit(false)} onSave={async () => {
          setShowEdit(false)
          await refreshUser()
          loadProfile()
        }} />
      )}
    </div>
  )
}

// ── Explore view ───────────────────────────────────────────
function ExploreView({ onAuthorClick }: { onAuthorClick: (h: string) => void }) {
  const [users, setUsers] = useState<(User & { isFollowing: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(async () => {
      const { ok, data } = await api.get(`/api/users${search ? `?search=${encodeURIComponent(search)}` : ''}`)
      if (ok && data) setUsers(data)
      setLoading(false)
    }, search ? 400 : 0)
    return () => clearTimeout(t)
  }, [search])

  async function toggleFollow(uid: string, idx: number) {
    const { ok, data } = await api.post('/api/follow', { targetUserId: uid })
    if (ok && data) setUsers(prev => prev.map((u, i) => i === idx ? { ...u, isFollowing: data.following } : u))
  }

  return (
    <div>
      <input type="text" placeholder="Search by name or @handle…"
        className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm mb-5 outline-none focus:border-rust transition-colors shadow-sm"
        value={search} onChange={e => setSearch(e.target.value)} />

      {loading
        ? <div className="text-center py-10 text-stone-400">Loading…</div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {users.map((u, i) => (
              <div key={u.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar user={u} onClick={() => onAuthorClick(u.handle)} />
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onAuthorClick(u.handle)}>
                    <div className="flex items-center gap-1.5">
                      <div className="font-semibold text-sm text-stone-900">{u.name}</div>
                      {u.is_admin && <span className="text-[8px] bg-gold/15 text-amber-700 px-1 py-0.5 rounded font-mono">ADMIN</span>}
                    </div>
                    <div className="font-mono text-xs text-stone-400">@{u.handle}</div>
                  </div>
                  <button onClick={() => toggleFollow(u.id, i)}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0
                      ${u.isFollowing ? 'bg-rust/10 border-rust/30 text-rust' : 'border-rust2/50 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}>
                    {u.isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
                {u.bio && <p className="text-xs text-stone-500 leading-relaxed mb-2 line-clamp-2">{u.bio}</p>}
                <div className="flex gap-4 text-xs text-stone-400">
                  <span><strong className="text-stone-700">{u.follower_count}</strong> followers</span>
                  <span><strong className="text-stone-700">{u.source_rate}%</strong> sourced</span>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

// ── Feed view ──────────────────────────────────────────────
function FeedView({ feedType, showCompose, onAuthorClick }: {
  feedType: 'home' | 'following' | 'trending'
  showCompose: boolean
  onAuthorClick: (h: string) => void
}) {
  const { user } = useAuth()
  const { posts, loading, hasMore, load, setPosts } = useFeed(feedType, true)

  return (
    <div>
      {showCompose && user && <Compose onPost={p => setPosts(prev => [p, ...prev])} />}
      {!user && feedType === 'home' && (
        <div className="bg-ink rounded-xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />
          <div className="font-serif text-xl font-black text-paper mb-1">Welcome to Veracast</div>
          <div className="text-stone-400 text-sm mb-4">The social platform where facts need proof. Post news, cite sources, spread truth.</div>
        </div>
      )}
      {feedType === 'following' && !loading && posts.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-stone-100">
          <div className="text-4xl mb-3">👥</div>
          <div className="font-serif text-xl font-bold text-stone-800 mb-2">Nobody followed yet</div>
          <div className="text-sm text-stone-500">Head to <strong>Explore</strong> and follow people to see their posts here.</div>
        </div>
      )}
      {loading && posts.length === 0
        ? <div className="text-center py-16 text-stone-400">Loading…</div>
        : posts.map(p => <PostCard key={p.id} post={p} onAuthorClick={onAuthorClick} />)
      }
      {hasMore && !loading && (
        <button onClick={() => load()} className="w-full py-3 text-sm text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-xl mt-2">
          Load more
        </button>
      )}
    </div>
  )
}

// ── Trending view ──────────────────────────────────────────
function TrendingView({ onAuthorClick }: { onAuthorClick: (h: string) => void }) {
  const { posts, loading } = useFeed('trending', true)
  return (
    <div>
      <div className="bg-ink rounded-xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-rust/20 blur-3xl pointer-events-none" />
        <div className="font-mono text-[10px] text-rust2 uppercase tracking-widest mb-2">// Live Rankings</div>
        <div className="font-serif text-2xl font-black text-paper">Trending on Veracast</div>
        <div className="text-stone-400 text-sm mt-1.5">Sourced posts always ranked first</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
        {TRENDING_TOPICS.map((t, i) => (
          <div key={t.tag} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
            <div className="font-mono text-[10px] text-stone-400 mb-1.5">#{i + 1} trending</div>
            <div className="font-serif text-lg font-bold text-stone-900">{t.tag}</div>
            <div className="text-xs text-stone-400 mt-1">{t.posts} posts this week</div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-stone-400 mb-1"><span>% sourced</span><span>{t.sourced}%</span></div>
              <div className="h-1 bg-stone-100 rounded overflow-hidden">
                <div className="h-full rounded bg-gradient-to-r from-sage2 to-gold2" style={{ width: `${t.sourced}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="font-serif text-xl font-bold text-stone-900 mb-4">Top Sourced Posts</div>
      {loading ? <div className="text-center py-10 text-stone-400">Loading…</div>
        : posts.filter(p => p.sources && p.sources.length > 0).map(p => <PostCard key={p.id} post={p} onAuthorClick={onAuthorClick} />)
      }
    </div>
  )
}

// ── Right panel ────────────────────────────────────────────
function RightPanel({ onAuthorClick }: { onAuthorClick: (h: string) => void }) {
  const { user } = useAuth()
  const [suggested, setSuggested] = useState<(User & { isFollowing: boolean })[]>([])

  useEffect(() => {
    api.get('/api/users').then(({ ok, data }) => { if (ok && data) setSuggested(data.slice(0, 4)) })
  }, [])

  async function toggleFollow(uid: string, idx: number) {
    const { ok, data } = await api.post('/api/follow', { targetUserId: uid })
    if (ok && data) setSuggested(prev => prev.map((u, i) => i === idx ? { ...u, isFollowing: data.following } : u))
  }

  return (
    <aside className="hidden xl:block w-72 flex-shrink-0 space-y-4">
      <div className="bg-ink rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust to-gold" />
        <div className="font-serif text-sm font-bold text-paper mb-3">🔥 Trending</div>
        {TRENDING_TOPICS.slice(0, 5).map((t, i) => (
          <div key={t.tag} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
            <span className="font-mono text-[10px] text-stone-500 w-4 flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-paper truncate">{t.tag}</div>
              <div className="font-mono text-[10px] text-stone-500">{t.posts} posts</div>
            </div>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-sage2/15 text-sage2 border border-sage2/25 flex-shrink-0">{t.sourced}%</span>
          </div>
        ))}
      </div>

      {user && suggested.length > 0 && (
        <div className="bg-ink rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sage2 to-gold" />
          <div className="font-serif text-sm font-bold text-paper mb-3">Who to Follow</div>
          {suggested.map((u, i) => (
            <div key={u.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
              <Avatar user={u} size="sm" onClick={() => onAuthorClick(u.handle)} />
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onAuthorClick(u.handle)}>
                <div className="text-xs font-semibold text-paper truncate">{u.name}</div>
                <div className="font-mono text-[10px] text-stone-500">@{u.handle}</div>
              </div>
              <button onClick={() => toggleFollow(u.id, i)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded border transition-all flex-shrink-0
                  ${u.isFollowing ? 'bg-rust/15 border-rust/30 text-rust2' : 'border-rust2/50 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}>
                {u.isFollowing ? '✓' : 'Follow'}
              </button>
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

// ── Root app ───────────────────────────────────────────────
type View = { type: 'home' } | { type: 'following' } | { type: 'trending' } | { type: 'explore' } | { type: 'profile'; handle: string } | { type: 'messages' } | { type: 'admin' }

export default function AppShell() {
  const { user, loading, logout, refreshUser } = useAuth()
  const [view, setView] = useState<View>({ type: 'home' })
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({ open: false, mode: 'login' })
  const [showNotifs, setShowNotifs] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    if (!user) return
    const check = async () => {
      const [{ data: nd }, { data: convs }] = await Promise.all([
        api.get('/api/notifications'),
        api.get('/api/conversations'),
      ])
      if (nd) setUnreadNotifs(nd.unread || 0)
      if (convs) setUnreadMessages(convs.reduce((a: number, c: { unread_count: number }) => a + (c.unread_count || 0), 0))
    }
    check()
    const interval = setInterval(check, 30000)
    return () => clearInterval(interval)
  }, [user])

  const navItems = [
    { id: 'home',      icon: '🏠', label: 'Home' },
    { id: 'following', icon: '👥', label: 'Following' },
    { id: 'trending',  icon: '🔥', label: 'Trending' },
    { id: 'explore',   icon: '🔎', label: 'Explore' },
    { id: 'messages',  icon: '💬', label: 'Messages', badge: unreadMessages },
    ...(user?.is_admin ? [{ id: 'admin', icon: '⚙️', label: 'Admin' }] : []),
  ]

  function goAuthor(handle: string) { setView({ type: 'profile', handle }) }

  const PAGE_TITLES: Record<string, string> = {
    home: 'Your Flow', following: 'Following', trending: 'Trending',
    explore: 'Explore', messages: 'Messages', admin: 'Admin Panel', profile: '',
  }
  const PAGE_SUBS: Record<string, string> = {
    home: 'Latest from everyone on Veracast',
    following: 'Posts from people you follow',
    trending: 'Top topics right now',
    explore: 'Discover people and topics',
    messages: 'Your private conversations',
    admin: 'Platform management',
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="font-serif text-3xl font-black text-ink">Vera<span className="text-rust2">cast</span></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-ink border-b-2 border-rust h-14 flex items-center px-4 gap-4">
        <button onClick={() => setView({ type: 'home' })} className="font-serif text-xl font-black text-paper hover:opacity-80 transition-opacity">
          Vera<span className="text-rust2">cast</span>
        </button>

        <nav className="hidden md:flex items-center gap-0.5 ml-4">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setView({ type: n.id as View['type'] })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all relative
                ${view.type === n.id ? 'bg-rust/20 text-paper' : 'text-stone-400 hover:text-paper hover:bg-white/5'}`}>
              <span className="mr-1">{n.icon}</span>{n.label}
              {n.badge > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rust text-white text-[8px] rounded-full flex items-center justify-center font-bold">{n.badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto">
          {user ? (
            <>
              <button onClick={() => { setShowNotifs(true); setUnreadNotifs(0) }}
                className="relative w-8 h-8 rounded-lg bg-white/8 border border-white/12 flex items-center justify-center text-stone-400 hover:text-paper transition-colors">
                🔔
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rust text-white text-[8px] rounded-full flex items-center justify-center font-bold">{unreadNotifs}</span>
                )}
              </button>
              <button onClick={() => setView({ type: 'profile', handle: user.handle })}
                className="w-8 h-8 rounded-full overflow-hidden border-2 border-transparent hover:border-rust2 transition-colors flex-shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold" style={{ background: user.avatar_color }}>
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                }
              </button>
              <button onClick={logout} className="text-xs text-stone-500 hover:text-stone-300 px-2 transition-colors">
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setAuthModal({ open: true, mode: 'login' })} className="text-sm font-medium text-stone-400 hover:text-paper px-3 py-1.5 transition-colors">Sign in</button>
              <button onClick={() => setAuthModal({ open: true, mode: 'register' })} className="text-sm font-semibold bg-rust text-white px-4 py-1.5 rounded-lg hover:bg-rust2 transition-colors">Join</button>
            </>
          )}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink border-t border-white/8 flex safe-bottom">
        {navItems.slice(0, 5).map(n => (
          <button key={n.id} onClick={() => setView({ type: n.id as View['type'] })}
            className={`flex-1 flex flex-col items-center py-2.5 text-[9px] gap-0.5 transition-colors relative
              ${view.type === n.id ? 'text-rust2' : 'text-stone-500'}`}>
            <span className="text-base">{n.icon}</span>{n.label}
            {n.badge > 0 && <span className="absolute top-1 right-1/4 w-3.5 h-3.5 bg-rust text-white text-[7px] rounded-full flex items-center justify-center font-bold">{n.badge}</span>}
          </button>
        ))}
      </nav>

      {/* Layout */}
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8 flex gap-6">
        {/* Left nav — desktop */}
        <nav className="hidden lg:flex flex-col w-44 flex-shrink-0 gap-0.5 sticky top-20 h-fit">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setView({ type: n.id as View['type'] })}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left border-l-2 relative
                ${view.type === n.id ? 'bg-rust/10 text-ink border-rust font-semibold' : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-800'}`}>
              <span>{n.icon}</span>{n.label}
              {n.badge > 0 && <span className="ml-auto bg-rust text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{n.badge}</span>}
            </button>
          ))}
          {user && (
            <button onClick={() => setView({ type: 'profile', handle: user.handle })}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left border-l-2
                ${view.type === 'profile' ? 'bg-rust/10 text-ink border-rust font-semibold' : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-800'}`}>
              <span>👤</span>My Profile
            </button>
          )}
        </nav>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {view.type !== 'profile' && (
            <div className="mb-5 pb-4 border-b border-stone-200">
              <h1 className="font-serif text-2xl font-black text-stone-900">{PAGE_TITLES[view.type]}</h1>
              <p className="text-stone-400 text-sm mt-0.5">{PAGE_SUBS[view.type]}</p>
            </div>
          )}

          {view.type === 'home'      && <FeedView feedType="home"     showCompose={!!user} onAuthorClick={goAuthor} />}
          {view.type === 'following' && <FeedView feedType="following" showCompose={false}  onAuthorClick={goAuthor} />}
          {view.type === 'trending'  && <TrendingView onAuthorClick={goAuthor} />}
          {view.type === 'explore'   && <ExploreView  onAuthorClick={goAuthor} />}
          {view.type === 'messages'  && (user ? <ChatView /> : <div className="text-center py-10 text-stone-400">Sign in to use messages.</div>)}
          {view.type === 'admin'     && user?.is_admin && <AdminPanel />}
          {view.type === 'profile'   && <ProfileView handle={view.handle} onAuthorClick={goAuthor} onBack={() => setView({ type: 'home' })} />}

          {!user && view.type === 'home' && (
            <div className="mt-6 text-center py-12 bg-white rounded-xl border border-stone-100 shadow-sm">
              <div className="font-serif text-xl font-bold text-stone-800 mb-2">Join Veracast</div>
              <p className="text-sm text-stone-500 mb-5">Sign up to post, follow people, and join the conversation.</p>
              <button onClick={() => setAuthModal({ open: true, mode: 'register' })}
                className="px-8 py-2.5 bg-rust text-white rounded-lg font-semibold text-sm hover:bg-rust2 transition-colors">
                Create Account
              </button>
            </div>
          )}
        </main>

        {/* Right panel */}
        {view.type !== 'messages' && view.type !== 'admin' && <RightPanel onAuthorClick={goAuthor} />}
      </div>

      {authModal.open && <AuthModal defaultMode={authModal.mode} onClose={() => setAuthModal({ open: false, mode: 'login' })} />}
      {showNotifs && <NotificationsPanel onClose={() => setShowNotifs(false)} />}
      {showEditProfile && user && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)} onSave={async () => {
          setShowEditProfile(false)
          await refreshUser()
        }} />
      )}
    </div>
  )
}
