'use client'
import { useState, useEffect, useCallback } from 'react'
import { Post, User } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import PostCard from '@/components/PostCard'
import Compose from '@/components/Compose'
import AuthModal from '@/components/AuthModal'

// ── tiny util ──────────────────────────────────────────────
function Avatar({ user, size = 'md', onClick }: { user: { name: string; avatar_color: string; handle?: string }; size?: 'sm' | 'md' | 'lg'; onClick?: () => void }) {
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-9 h-9 text-sm'
  return (
    <button onClick={onClick} className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 hover:opacity-80 transition-opacity`} style={{ background: user.avatar_color }}>
      {user.name.slice(0, 2).toUpperCase()}
    </button>
  )
}

// ── feed loader ────────────────────────────────────────────
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

// ── Trending topics data ────────────────────────────────────
const TRENDING_TOPICS = [
  { tag: '#HighwayClosure', posts: '1.2K', sourced: 91 },
  { tag: '#ClimateReport',  posts: '4.8K', sourced: 87 },
  { tag: '#EUAILaw',        posts: '3.2K', sourced: 82 },
  { tag: '#Measles2026',    posts: '2.9K', sourced: 94 },
  { tag: '#InflationData',  posts: '1.9K', sourced: 79 },
  { tag: '#GPT5Release',    posts: '5.6K', sourced: 71 },
]

// ── Profile view ───────────────────────────────────────────
function ProfileView({ handle, onAuthorClick, onBack }: { handle: string; onAuthorClick: (h: string) => void; onBack: () => void }) {
  const { user: me } = useAuth()
  const [data, setData] = useState<{ user: User & { isFollowing?: boolean }; posts: Post[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'posts' | 'sourced' | 'liked'>('posts')
  const [following, setFollowing] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get(`/api/users/${handle}`).then(({ ok, data: d }) => {
      if (ok && d) { setData(d); setFollowing(d.user.isFollowing ?? false) }
      setLoading(false)
    })
  }, [handle])

  async function toggleFollow() {
    if (!data) return
    const { ok, data: res } = await api.post('/api/follow', { targetUserId: data.user.id })
    if (ok && res) setFollowing(res.following)
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

      {/* Profile card */}
      <div className="bg-ink rounded-xl overflow-hidden mb-6">
        {/* Banner */}
        <div className="h-28 bg-gradient-to-br from-ink3 via-slate-800 to-stone-900 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(245,242,235,.3) 20px,rgba(245,242,235,.3) 21px)' }} />
        </div>

        <div className="px-6 pb-6 relative">
          <div className="absolute -top-9 left-6 w-18 h-18">
            <div className="w-16 h-16 rounded-full border-4 border-ink flex items-center justify-center text-white font-bold text-2xl" style={{ background: user.avatar_color }}>
              {user.name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="flex justify-end pt-3">
            {isMe
              ? <button className="border border-stone-500 text-stone-400 text-xs font-semibold px-4 py-1.5 rounded-lg">Edit Profile</button>
              : <button
                  onClick={toggleFollow}
                  className={`text-xs font-semibold px-5 py-1.5 rounded-lg border-2 transition-all
                    ${following ? 'bg-rust border-rust text-white hover:bg-transparent hover:text-mist hover:border-stone-500' : 'border-rust2 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}
                >
                  {following ? 'Following' : 'Follow'}
                </button>
            }
          </div>

          <div className="mt-8">
            <div className="font-serif text-xl font-black text-paper">{user.name}</div>
            <div className="font-mono text-xs text-stone-500 mt-0.5">@{user.handle}</div>
            {user.bio && <div className="text-sm text-stone-300 mt-2 leading-relaxed">{user.bio}</div>}
          </div>

          <div className="flex gap-6 mt-4">
            {[['posts', user.post_count], ['following', user.following_count], ['followers', user.follower_count]].map(([label, val]) => (
              <div key={label as string}>
                <div className="font-serif text-lg font-bold text-paper">{val}</div>
                <div className="font-mono text-[10px] text-stone-500">{label as string}</div>
              </div>
            ))}
          </div>

          {/* Source rate bar */}
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
    </div>
  )
}

// ── Explore view ───────────────────────────────────────────
function ExploreView({ onAuthorClick }: { onAuthorClick: (h: string) => void }) {
  const [users, setUsers] = useState<(User & { isFollowing: boolean })[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/api/users').then(({ ok, data }) => {
      if (ok && data) setUsers(data)
      setLoading(false)
    })
  }, [])

  async function toggleFollow(uid: string, idx: number) {
    const { ok, data } = await api.post('/api/follow', { targetUserId: uid })
    if (ok && data) {
      setUsers(prev => prev.map((u, i) => i === idx ? { ...u, isFollowing: data.following } : u))
    }
  }

  if (loading) return <div className="text-center py-20 text-stone-400">Loading…</div>

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {users.map((u, i) => (
        <div key={u.id} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={u} onClick={() => onAuthorClick(u.handle)} />
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onAuthorClick(u.handle)}>
              <div className="font-semibold text-sm text-stone-900">{u.name}</div>
              <div className="font-mono text-xs text-stone-400">@{u.handle}</div>
            </div>
            <button
              onClick={() => toggleFollow(u.id, i)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex-shrink-0
                ${u.isFollowing ? 'bg-rust/10 border-rust/30 text-rust' : 'border-rust2/50 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}
            >
              {u.isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
          {u.bio && <p className="text-xs text-stone-500 leading-relaxed mb-2">{u.bio}</p>}
          <div className="flex gap-4 text-xs text-stone-400">
            <span><strong className="text-stone-700">{u.follower_count}</strong> followers</span>
            <span><strong className="text-stone-700">{u.source_rate}%</strong> sourced</span>
          </div>
        </div>
      ))}
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

  function handleNewPost(post: Post) {
    setPosts(prev => [post, ...prev])
  }

  if (feedType === 'following' && !loading && posts.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-stone-100">
        <div className="text-4xl mb-3">👥</div>
        <div className="font-serif text-xl font-bold text-stone-800 mb-2">Nobody followed yet</div>
        <div className="text-sm text-stone-500">Head to <strong>Explore</strong> and follow some people to see their posts here.</div>
      </div>
    )
  }

  return (
    <div>
      {showCompose && user && <Compose onPost={handleNewPost} />}
      {loading && posts.length === 0
        ? <div className="text-center py-16 text-stone-400">Loading…</div>
        : posts.map(p => <PostCard key={p.id} post={p} onAuthorClick={onAuthorClick} />)
      }
      {hasMore && !loading && (
        <button onClick={() => load()} className="w-full py-3 text-sm text-stone-400 hover:text-stone-600 transition-colors border border-stone-200 rounded-xl mt-2">
          Load more
        </button>
      )}
      {loading && posts.length > 0 && <div className="text-center py-4 text-stone-400 text-sm">Loading…</div>}
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
        <div className="text-stone-400 text-sm mt-1.5">Ranked by engagement — sourced posts always shown first</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-8">
        {TRENDING_TOPICS.map((t, i) => (
          <div key={t.tag} className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
            <div className="font-mono text-[10px] text-stone-400 mb-1.5">#{i + 1} trending</div>
            <div className="font-serif text-lg font-bold text-stone-900">{t.tag}</div>
            <div className="text-xs text-stone-400 mt-1">{t.posts} posts this week</div>
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-stone-400 mb-1">
                <span>% sourced</span><span>{t.sourced}%</span>
              </div>
              <div className="h-1 bg-stone-100 rounded overflow-hidden">
                <div className="h-full rounded bg-gradient-to-r from-sage2 to-gold2" style={{ width: `${t.sourced}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="font-serif text-xl font-bold text-stone-900 mb-4">Top Sourced Posts</div>
      {loading
        ? <div className="text-center py-10 text-stone-400">Loading…</div>
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
    api.get('/api/users').then(({ ok, data }) => {
      if (ok && data) setSuggested(data.slice(0, 4))
    })
  }, [])

  async function toggleFollow(uid: string, idx: number) {
    const { ok, data } = await api.post('/api/follow', { targetUserId: uid })
    if (ok && data) setSuggested(prev => prev.map((u, i) => i === idx ? { ...u, isFollowing: data.following } : u))
  }

  return (
    <aside className="hidden xl:block w-72 flex-shrink-0">
      {/* Trending mini */}
      <div className="bg-ink rounded-xl p-4 mb-4 relative overflow-hidden">
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

      {/* Who to follow */}
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
              <button
                onClick={() => toggleFollow(u.id, i)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded border transition-all flex-shrink-0
                  ${u.isFollowing ? 'bg-rust/15 border-rust/30 text-rust2' : 'border-rust2/50 text-rust2 hover:bg-rust hover:border-rust hover:text-white'}`}
              >
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
type View = { type: 'home' } | { type: 'following' } | { type: 'trending' } | { type: 'explore' } | { type: 'profile'; handle: string }

export default function AppShell() {
  const { user, loading, logout } = useAuth()
  const [view, setView] = useState<View>({ type: 'home' })
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'register' }>({ open: false, mode: 'login' })
  const [navOpen, setNavOpen] = useState(false)

  const navItems: { id: View['type']; icon: string; label: string }[] = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'following', icon: '👥', label: 'Following' },
    { id: 'trending', icon: '🔥', label: 'Trending' },
    { id: 'explore', icon: '🔎', label: 'Explore' },
  ]

  function goAuthor(handle: string) {
    setView({ type: 'profile', handle })
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

        <div className="flex-1" />

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => setView({ type: n.id as View['type'] })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${view.type === n.id ? 'bg-rust/20 text-paper border-l-2 border-rust2' : 'text-stone-400 hover:text-paper hover:bg-white/5'}`}
            >
              <span className="mr-1.5">{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-4">
          {user ? (
            <>
              <button onClick={() => setView({ type: 'profile', handle: user.handle })}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold border-2 border-transparent hover:border-rust2 transition-colors"
                style={{ background: user.avatar_color }}>
                {user.name.slice(0, 2).toUpperCase()}
              </button>
              <button onClick={logout} className="text-xs text-stone-500 hover:text-stone-300 transition-colors px-2">
                Sign out
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setAuthModal({ open: true, mode: 'login' })}
                className="text-sm font-medium text-stone-400 hover:text-paper px-3 py-1.5 transition-colors">
                Sign in
              </button>
              <button onClick={() => setAuthModal({ open: true, mode: 'register' })}
                className="text-sm font-semibold bg-rust text-white px-4 py-1.5 rounded-lg hover:bg-rust2 transition-colors">
                Join
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-ink border-t border-white/8 flex">
        {navItems.map(n => (
          <button
            key={n.id}
            onClick={() => setView({ type: n.id as View['type'] })}
            className={`flex-1 flex flex-col items-center py-3 text-[10px] gap-1 transition-colors
              ${view.type === n.id ? 'text-rust2' : 'text-stone-500'}`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </button>
        ))}
        {user
          ? <button onClick={() => setView({ type: 'profile', handle: user.handle })} className={`flex-1 flex flex-col items-center py-3 text-[10px] gap-1 ${view.type === 'profile' ? 'text-rust2' : 'text-stone-500'}`}>
              <span className="text-lg">👤</span>Me
            </button>
          : <button onClick={() => setAuthModal({ open: true, mode: 'login' })} className="flex-1 flex flex-col items-center py-3 text-[10px] gap-1 text-stone-500">
              <span className="text-lg">👤</span>Sign in
            </button>
        }
      </nav>

      {/* Main layout */}
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6 flex gap-6">
        {/* Left nav — desktop */}
        <nav className="hidden lg:flex flex-col w-48 flex-shrink-0 gap-0.5 sticky top-20 h-fit">
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => setView({ type: n.id as View['type'] })}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left border-l-2
                ${view.type === n.id ? 'bg-rust/10 text-ink border-rust font-semibold' : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-800'}`}
            >
              <span>{n.icon}</span>{n.label}
            </button>
          ))}
          {user && (
            <button
              onClick={() => setView({ type: 'profile', handle: user.handle })}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left border-l-2
                ${view.type === 'profile' ? 'bg-rust/10 text-ink border-rust font-semibold' : 'text-stone-500 border-transparent hover:bg-stone-100 hover:text-stone-800'}`}
            >
              <span>👤</span>My Profile
            </button>
          )}
        </nav>

        {/* Center */}
        <main className="flex-1 min-w-0">
          {/* Page header */}
          <div className="mb-5 pb-4 border-b border-stone-200">
            <h1 className="font-serif text-2xl font-black text-stone-900">
              {view.type === 'home' && 'Your Flow'}
              {view.type === 'following' && 'Following'}
              {view.type === 'trending' && 'Trending'}
              {view.type === 'explore' && 'Explore'}
              {view.type === 'profile' && ''}
            </h1>
            <p className="text-stone-400 text-sm mt-0.5">
              {view.type === 'home' && 'Latest from everyone on Veracast'}
              {view.type === 'following' && 'Posts from people you follow'}
              {view.type === 'trending' && 'Top topics right now'}
              {view.type === 'explore' && 'Discover people and topics'}
            </p>
          </div>

          {view.type === 'home'      && <FeedView feedType="home"      showCompose={!!user} onAuthorClick={goAuthor} />}
          {view.type === 'following' && <FeedView feedType="following"  showCompose={false}  onAuthorClick={goAuthor} />}
          {view.type === 'trending'  && <TrendingView onAuthorClick={goAuthor} />}
          {view.type === 'explore'   && <ExploreView  onAuthorClick={goAuthor} />}
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
        <RightPanel onAuthorClick={goAuthor} />
      </div>

      {authModal.open && (
        <AuthModal defaultMode={authModal.mode} onClose={() => setAuthModal({ open: false, mode: 'login' })} />
      )}
    </div>
  )
}
