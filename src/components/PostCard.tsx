'use client'
import { useState } from 'react'
import { Post } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const BADGE: Record<string, string> = {
  News:      'bg-blue-50 text-blue-700 border border-blue-200',
  Science:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Opinion:   'bg-amber-50 text-amber-700 border border-amber-200',
  Meme:      'bg-purple-50 text-purple-700 border border-purple-200',
  Lifestyle: 'bg-orange-50 text-orange-700 border border-orange-200',
  General:   'bg-gray-100 text-gray-600 border border-gray-200',
}

const REACTIONS = ['❤️', '🔥', '😮', '🧐', '👏', '💡']

interface Comment {
  id: string
  content: string
  created_at: string
  user_id: string
  author?: { id: string; handle: string; name: string; avatar_color: string; avatar_url?: string; is_verified?: boolean }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface Props {
  post: Post
  onAuthorClick?: (handle: string) => void
  onUpdate?: (post: Post) => void
  featured?: boolean
}

export default function PostCard({ post, onAuthorClick, featured }: Props) {
  const { user } = useAuth()
  const [liked, setLiked]           = useState(post.liked ?? false)
  const [likes, setLikes]           = useState(post.like_count)
  const [bookmarked, setBookmarked] = useState(post.bookmarked ?? false)
  const [showComments, setShowComments] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [comments, setComments]     = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentCount, setCommentCount] = useState(post.comment_count)
  const [imgExpanded, setImgExpanded] = useState(false)
  const [copied, setCopied]         = useState(false)

  const author = post.author
  const initials = author?.name?.slice(0, 2).toUpperCase() || '??'

  async function handleLike() {
    if (!user) return
    setLiked(!liked)
    setLikes(l => liked ? l - 1 : l + 1)
    await api.post(`/api/posts/${post.id}/action`, { action: 'like' })
  }

  async function handleBookmark() {
    if (!user) return
    setBookmarked(b => !b)
    await api.post(`/api/posts/${post.id}/action`, { action: 'bookmark' })
  }

  async function handleShare() {
    const url = `${window.location.origin}?post=${post.id}`
    await navigator.clipboard.writeText(url).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function loadComments() {
    if (!commentsLoaded) {
      const { data } = await api.get(`/api/posts/${post.id}/comments`)
      setComments(data || [])
      setCommentsLoaded(true)
    }
    setShowComments(s => !s)
  }

  async function submitComment() {
    if (!commentText.trim() || !user) return
    const { ok, data } = await api.post(`/api/posts/${post.id}/comments`, { content: commentText })
    if (ok && data) {
      setComments(c => [...c, data])
      setCommentCount(n => n + 1)
      setCommentText('')
    }
  }

  async function handleReaction(emoji: string) {
    if (!user) return
    setShowReactions(false)
    // optimistically show like
    setLiked(true)
    setLikes(l => l + 1)
    await api.post(`/api/posts/${post.id}/action`, { action: 'like' })
  }

  return (
    <>
      <article className={`bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-all mb-3.5 overflow-hidden ${featured ? 'ring-2 ring-gold/30' : ''}`}>
        {/* Featured banner */}
        {featured && (
          <div className="bg-gradient-to-r from-gold/20 to-rust/10 px-4 py-1.5 flex items-center gap-2 border-b border-gold/20">
            <span className="text-xs font-bold text-amber-700">📌 Pinned post</span>
          </div>
        )}

        <div className="p-5">
          {/* Author row */}
          <div className="flex items-center gap-2.5 mb-3">
            <button onClick={() => onAuthorClick?.(author?.handle || '')}
              className="flex-shrink-0 hover:opacity-80 transition-opacity">
              {author?.avatar_url
                ? <img src={author.avatar_url} alt={author.name} className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: author?.avatar_color || '#888' }}>
                    {initials}
                  </div>
              }
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <button onClick={() => onAuthorClick?.(author?.handle || '')}
                  className="font-semibold text-sm text-stone-900 hover:text-rust transition-colors leading-none">
                  {author?.name}
                </button>
                {author?.is_verified && <span className="text-blue-500 text-sm" title="Verified">✓</span>}
                {author?.is_admin && <span className="text-[8px] bg-gold/15 text-amber-700 px-1 py-0.5 rounded font-mono">ADMIN</span>}
              </div>
              <div className="text-xs text-stone-400 font-mono">@{author?.handle} · {timeAgo(post.created_at)}</div>
            </div>
            <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
              <span className={`text-[9px] font-mono tracking-wide uppercase px-1.5 py-0.5 rounded ${BADGE[post.category] || BADGE.General}`}>
                {post.category}
              </span>
              {post.sources && post.sources.length > 0 && (
                <span className="text-xs" title="Has source">🔗</span>
              )}
            </div>
          </div>

          {/* Content */}
          {post.content && (
            <p className="text-sm leading-relaxed text-stone-800 mb-3 whitespace-pre-wrap break-words">
              {post.content.split(/(\s+)/).map((word, i) =>
                word.startsWith('#')
                  ? <span key={i} className="text-rust2 hover:underline cursor-pointer font-medium">{word}</span>
                  : word.startsWith('@')
                  ? <span key={i} className="text-blue-600 hover:underline cursor-pointer">{word}</span>
                  : word
              )}
            </p>
          )}

          {/* Image */}
          {post.image_url && (
            <div className="mb-3 rounded-xl overflow-hidden border border-stone-100 cursor-pointer" onClick={() => setImgExpanded(true)}>
              <img
                src={post.image_url}
                alt={post.image_caption || 'Post image'}
                className="w-full max-h-96 object-cover hover:opacity-95 transition-opacity"
                loading="lazy"
              />
              {post.image_caption && (
                <div className="px-3 py-2 text-xs text-stone-500 bg-stone-50 border-t border-stone-100">{post.image_caption}</div>
              )}
            </div>
          )}

          {/* Sources */}
          {post.sources && post.sources.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {post.sources.map(s => (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-l-2 text-xs transition-colors no-underline
                    ${s.match_status === 'match' ? 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100'
                    : s.match_status === 'partial' ? 'bg-amber-50 border-amber-400 hover:bg-amber-100'
                    : 'bg-stone-50 border-stone-300 hover:bg-stone-100'}`}>
                  <span className="w-5 h-5 rounded bg-stone-200 flex items-center justify-center font-bold text-stone-600 text-[10px] flex-shrink-0">
                    {s.domain[0]?.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[9px] font-mono uppercase tracking-wide font-medium
                      ${s.match_status === 'match' ? 'text-emerald-600' : s.match_status === 'partial' ? 'text-amber-600' : 'text-stone-500'}`}>
                      {s.domain}{s.is_trusted ? ' ✓' : ''}
                    </div>
                    <div className="text-stone-600 truncate">{s.url.replace(/https?:\/\//, '').slice(0, 60)}</div>
                  </div>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0
                    ${s.match_status === 'match' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                    {s.match_score}%
                  </span>
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-0 pt-3 border-t border-stone-100">
            {/* Like / Reactions */}
            <div className="relative">
              <button onClick={handleLike} onContextMenu={e => { e.preventDefault(); setShowReactions(r => !r) }}
                disabled={!user}
                className={`flex items-center gap-1.5 text-xs font-medium pr-4 py-1 transition-colors ${liked ? 'text-rust' : 'text-stone-400 hover:text-rust'} disabled:opacity-40`}
                title="Click to like · Right-click for reactions">
                <span>{liked ? '❤️' : '🤍'}</span>
                <span className="font-mono text-[10px]">{likes}</span>
              </button>

              {showReactions && (
                <div className="absolute bottom-8 left-0 bg-white rounded-xl border border-stone-200 shadow-xl p-1.5 flex gap-1 z-10 animate-fadeUp">
                  {REACTIONS.map(r => (
                    <button key={r} onClick={() => handleReaction(r)}
                      className="text-xl hover:scale-125 transition-transform p-1 rounded-lg hover:bg-stone-100">
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <button onClick={loadComments}
              className={`flex items-center gap-1.5 text-xs font-medium pr-4 py-1 transition-colors ${showComments ? 'text-rust' : 'text-stone-400 hover:text-stone-600'}`}>
              <span>💬</span>
              <span className="font-mono text-[10px]">{commentCount}</span>
            </button>

            {/* Share */}
            <button onClick={handleShare}
              className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 pr-4 py-1 transition-colors">
              <span>{copied ? '✓' : '↗'}</span>
              <span className="font-mono text-[10px] text-[10px]">{copied ? 'Copied' : post.share_count}</span>
            </button>

            {/* Bookmark */}
            <button onClick={handleBookmark} disabled={!user}
              className={`flex items-center gap-1.5 text-xs font-medium ml-auto py-1 transition-colors ${bookmarked ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'} disabled:opacity-40`}>
              {bookmarked ? '🔖' : '○'}
            </button>
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 pt-3 border-t border-stone-100">
              {comments.length === 0 && commentsLoaded && (
                <div className="text-center py-3 text-xs text-stone-400">No comments yet — be first!</div>
              )}
              <div className="space-y-3 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <button onClick={() => onAuthorClick?.(c.author?.handle || '')} className="flex-shrink-0 mt-0.5">
                      {c.author?.avatar_url
                        ? <img src={c.author.avatar_url} alt={c.author.name} className="w-6 h-6 rounded-full object-cover" />
                        : <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: c.author?.avatar_color || '#888' }}>
                            {c.author?.name?.slice(0, 2).toUpperCase()}
                          </div>
                      }
                    </button>
                    <div className="flex-1 bg-stone-50 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-semibold text-stone-800">{c.author?.name}</span>
                        {c.author?.is_verified && <span className="text-blue-500 text-[10px]">✓</span>}
                        <span className="text-[10px] text-stone-400">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>

              {user && (
                <div className="flex gap-2 items-end">
                  <div className="flex-shrink-0">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
                      : <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: user.avatar_color }}>
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                    }
                  </div>
                  <div className="flex-1 flex gap-2 items-end">
                    <input
                      type="text"
                      className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-rust transition-colors"
                      placeholder="Add a comment…"
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitComment()}
                      maxLength={280}
                    />
                    <button onClick={submitComment} disabled={!commentText.trim()}
                      className="px-3 py-2 bg-rust text-white rounded-xl text-xs font-semibold hover:bg-rust2 disabled:opacity-40 transition-colors">
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </article>

      {/* Image lightbox */}
      {imgExpanded && post.image_url && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setImgExpanded(false)}>
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-stone-300 transition-colors">✕</button>
          <img src={post.image_url} alt={post.image_caption || ''} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          {post.image_caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-lg">{post.image_caption}</div>
          )}
        </div>
      )}
    </>
  )
}
