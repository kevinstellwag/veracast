import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

const POST_SELECT = `
  id, user_id, content, category, claim_detected, image_url, image_caption,
  like_count, comment_count, share_count, created_at,
  author:users!user_id(id, handle, name, avatar_color, avatar_url, is_verified, is_admin, source_rate),
  sources:post_sources(id, url, domain, match_status, match_score, is_trusted)
`

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  const { searchParams } = new URL(req.url)
  const feed    = searchParams.get('feed') || 'home'
  const limit   = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
  const cursor  = searchParams.get('cursor')
  const tag     = searchParams.get('tag')
  const search  = searchParams.get('search')?.trim()

  let query = supabaseAdmin
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) query = query.lt('created_at', cursor)

  if (search) {
    query = query.ilike('content', `%${search}%`)
  } else if (tag) {
    // filter by hashtag
    const { data: taggedPostIds } = await supabaseAdmin
      .from('post_hashtags')
      .select('post_id')
      .eq('tag', tag.startsWith('#') ? tag.slice(1).toLowerCase() : tag.toLowerCase())
    const ids = taggedPostIds?.map(t => t.post_id) || []
    if (ids.length === 0) return NextResponse.json({ data: { posts: [], nextCursor: null } })
    query = query.in('id', ids)
  } else if (feed === 'following' && payload) {
    const { data: follows } = await supabaseAdmin
      .from('follows').select('following_id').eq('follower_id', payload.userId)
    const followingIds = follows?.map(f => f.following_id) || []
    if (followingIds.length === 0) return NextResponse.json({ data: { posts: [], nextCursor: null } })
    query = query.in('user_id', followingIds)
  } else if (feed === 'trending') {
    query = supabaseAdmin
      .from('posts')
      .select(POST_SELECT)
      .order('like_count', { ascending: false })
      .limit(limit)
  }

  const { data: posts, error } = await query
  if (error) {
    console.error('Posts fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }

  let likedIds = new Set<string>()
  let bookmarkedIds = new Set<string>()

  if (payload && posts && posts.length > 0) {
    const postIds = posts.map(p => p.id)
    const [{ data: likes }, { data: bookmarks }] = await Promise.all([
      supabaseAdmin.from('likes').select('post_id').eq('user_id', payload.userId).in('post_id', postIds),
      supabaseAdmin.from('bookmarks').select('post_id').eq('user_id', payload.userId).in('post_id', postIds),
    ])
    likedIds = new Set(likes?.map(l => l.post_id) || [])
    bookmarkedIds = new Set(bookmarks?.map(b => b.post_id) || [])
  }

  const enriched = (posts || []).map(p => ({
    ...p,
    liked: likedIds.has(p.id),
    bookmarked: bookmarkedIds.has(p.id),
  }))

  const nextCursor = enriched.length === limit ? enriched[enriched.length - 1].created_at : null
  return NextResponse.json({ data: { posts: enriched, nextCursor } })
}

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const { content, category, claim_detected, sources, image_url, image_caption } = await req.json()

    if (!content?.trim() && !image_url) {
      return NextResponse.json({ error: 'Post needs content or an image' }, { status: 400 })
    }
    if (content && content.length > 500) {
      return NextResponse.json({ error: 'Post too long (max 500 chars)' }, { status: 400 })
    }

    const EXEMPT = ['Opinion', 'Meme', 'Lifestyle']
    if (claim_detected && !EXEMPT.includes(category) && (!sources || sources.length === 0)) {
      return NextResponse.json({ error: 'A source is required for factual claims' }, { status: 400 })
    }

    const { data: post, error: postError } = await supabaseAdmin
      .from('posts')
      .insert({
        user_id: payload.userId,
        content: content?.trim() || '',
        category: category || 'General',
        claim_detected: !!claim_detected,
        image_url: image_url || null,
        image_caption: image_caption?.trim() || null,
      })
      .select('id')
      .single()

    if (postError || !post) {
      console.error('Post insert error:', postError)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    if (sources && sources.length > 0) {
      await supabaseAdmin.from('post_sources').insert(
        sources.map((s: { url: string; domain: string; match_status: string; match_score: number; is_trusted: boolean }) => ({
          post_id: post.id, url: s.url, domain: s.domain,
          match_status: s.match_status, match_score: s.match_score, is_trusted: s.is_trusted,
        }))
      )
    }

    // Extract hashtags
    const tags = (content || '').match(/#[a-zA-Z0-9_]+/g) || []
    if (tags.length > 0) {
      await supabaseAdmin.from('post_hashtags').insert(
        tags.slice(0, 10).map((t: string) => ({ post_id: post.id, tag: t.slice(1).toLowerCase() }))
      ).catch(() => {}) // ignore duplicates
    }

    // Update user stats
    const hasSources = sources && sources.length > 0
    const { data: u } = await supabaseAdmin.from('users').select('post_count, source_rate').eq('id', payload.userId).single()
    if (u) {
      const newCount = (u.post_count || 0) + 1
      const sourcedCount = Math.round(((u.source_rate || 0) / 100) * (u.post_count || 0)) + (hasSources ? 1 : 0)
      await supabaseAdmin.from('users').update({
        post_count: newCount,
        source_rate: Math.round((sourcedCount / newCount) * 100)
      }).eq('id', payload.userId)
    }

    // Return full post
    const { data: fullPost } = await supabaseAdmin
      .from('posts')
      .select(POST_SELECT)
      .eq('id', post.id)
      .single()

    return NextResponse.json({ data: { ...fullPost, liked: false, bookmarked: false } }, { status: 201 })
  } catch (e) {
    console.error('Post create error:', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
