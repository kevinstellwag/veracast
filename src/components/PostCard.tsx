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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

interface Props {
  post: Post
  onAuthorClick?: (handle: string) => void
  onUpdate?: (post: Post) => void
}

export default function PostCard({ post, onAuthorClick, onUpdate }: Props) {
  const { user } = useAuth()
  const [liked, setLiked] = useState(post.liked ?? false)
  const [likes, setLikes] = useState(post.like_count)
  const [bookmarked, setBookmarked] = useState(post.bookmarked ?? false)
  const [loadingLike, setLoadingLike] = useState(false)

  const author = post.author
  const initials = author?.name?.slice(0, 2).toUpperCase() || '??'

  async function handleLike() {
    if (!user) return
    setLoadingLike(true)
    const prev = liked
    setLiked(!prev)
    setLikes(l => prev ? l - 1 : l + 1)
    await api.post(`/api/posts/${post.id}/action`, { action: 'like' })
    setLoadingLike(false)
  }

  async function handleBookmark() {
    if (!user) return
    setBookmarked(b => !b)
    await api.post(`/api/posts/${post.id}/action`, { action: 'bookmark' })
  }

  async function handleShare() {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${post.id}`).catch(() => {})
    // optimistic share count
    if (onUpdate) onUpdate({ ...post, share_count: post.share_count + 1 })
  }

  return (
    <article className="bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md transition-shadow p-5 mb-3.5">
      {/* Meta row */}
      <div className="flex items-center gap-2.5 mb-3">
        <button
          onClick={() => onAuthorClick?.(author?.handle || '')}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 hover:opacity-80 transition-opacity"
          style={{ background: author?.avatar_color || '#888' }}
        >
          {initials}
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => onAuthorClick?.(author?.handle || '')}
            className="font-semibold text-sm text-stone-900 hover:text-rust transition-colors"
          >
            {author?.name}
          </button>
          <div className="text-xs text-stone-400 font-mono">
            @{author?.handle} · {timeAgo(post.created_at)}
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className={`text-[9px] font-mono tracking-wide uppercase px-1.5 py-0.5 rounded ${BADGE[post.category] || BADGE.General}`}>
            {post.category}
          </span>
          {post.sources && post.sources.length > 0 && (
            <span className="text-xs" title="Has source">🔗</span>
          )}
        </div>
      </div>

      {/* Content */}
      <p className="text-sm leading-relaxed text-stone-800 mb-3">{post.content}</p>

      {/* Sources */}
      {post.sources && post.sources.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {post.sources.map(s => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border-l-2 text-xs transition-colors no-underline
                ${s.match_status === 'match'
                  ? 'bg-emerald-50 border-emerald-400 hover:bg-emerald-100'
                  : s.match_status === 'partial'
                  ? 'bg-amber-50 border-amber-400 hover:bg-amber-100'
                  : 'bg-stone-50 border-stone-300 hover:bg-stone-100'}`}
            >
              <span className="w-5 h-5 rounded bg-stone-200 flex items-center justify-center font-bold text-stone-600 font-mono flex-shrink-0 text-[10px]">
                {s.domain[0]?.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className={`text-[9px] font-mono uppercase tracking-wide font-medium
                  ${s.match_status === 'match' ? 'text-emerald-600' : s.match_status === 'partial' ? 'text-amber-600' : 'text-stone-500'}`}>
                  {s.domain}{s.is_trusted ? ' ✓' : ''}
                </div>
                <div className="text-stone-600 truncate">{s.url.replace(/https?:\/\//, '').slice(0, 60)}…</div>
              </div>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0
                ${s.match_status === 'match'
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                {s.match_score}%
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0 pt-3 border-t border-stone-100">
        <button
          onClick={handleLike}
          disabled={!user || loadingLike}
          className={`flex items-center gap-1.5 text-xs font-medium pr-4 py-1 transition-colors ${liked ? 'text-rust' : 'text-stone-400 hover:text-rust'} disabled:opacity-40`}
        >
          <span>{liked ? '❤️' : '🤍'}</span>
          <span className="font-mono text-[10px]">{likes}</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 pr-4 py-1 transition-colors">
          <span>💬</span>
          <span className="font-mono text-[10px]">{post.comment_count}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-xs font-medium text-stone-400 hover:text-stone-600 pr-4 py-1 transition-colors"
        >
          <span>↗</span>
          <span className="font-mono text-[10px]">{post.share_count}</span>
        </button>
        <button
          onClick={handleBookmark}
          disabled={!user}
          className={`flex items-center gap-1.5 text-xs font-medium ml-auto py-1 transition-colors ${bookmarked ? 'text-amber-500' : 'text-stone-400 hover:text-amber-500'} disabled:opacity-40`}
        >
          {bookmarked ? '🔖' : '○'} {bookmarked ? 'Saved' : 'Save'}
        </button>
      </div>
    </article>
  )
}
