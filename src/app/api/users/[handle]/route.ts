import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/users/[handle]
export async function GET(
  req: NextRequest,
  { params }: { params: { handle: string } }
) {
  const payload = getTokenFromRequest(req)
  const handle = params.handle.toLowerCase()

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, handle, name, bio, avatar_color, source_rate, post_count, follower_count, following_count, created_at')
    .eq('handle', handle)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Is the current user following this user?
  let isFollowing = false
  if (payload && payload.userId !== user.id) {
    const { data: follow } = await supabaseAdmin
      .from('follows')
      .select('follower_id')
      .eq('follower_id', payload.userId)
      .eq('following_id', user.id)
      .single()
    isFollowing = !!follow
  }

  // Get this user's posts
  const { data: posts } = await supabaseAdmin
    .from('posts')
    .select(`
      id, user_id, content, category, claim_detected,
      like_count, comment_count, share_count, created_at,
      author:users!user_id(id, handle, name, avatar_color, source_rate),
      sources:post_sources(id, url, domain, match_status, match_score, is_trusted)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  // Add liked/bookmarked for current user
  let likedIds = new Set<string>()
  let bookmarkedIds = new Set<string>()

  if (payload && posts && posts.length > 0) {
    const postIds = posts.map((p: { id: string }) => p.id)
    const [{ data: likes }, { data: bookmarks }] = await Promise.all([
      supabaseAdmin.from('likes').select('post_id').eq('user_id', payload.userId).in('post_id', postIds),
      supabaseAdmin.from('bookmarks').select('post_id').eq('user_id', payload.userId).in('post_id', postIds),
    ])
    likedIds = new Set(likes?.map((l: { post_id: string }) => l.post_id) || [])
    bookmarkedIds = new Set(bookmarks?.map((b: { post_id: string }) => b.post_id) || [])
  }

  const enrichedPosts = (posts || []).map((p: { id: string }) => ({
    ...p,
    liked: likedIds.has(p.id),
    bookmarked: bookmarkedIds.has(p.id),
  }))

  return NextResponse.json({
    data: {
      user: { ...user, isFollowing },
      posts: enrichedPosts,
    }
  })
}
