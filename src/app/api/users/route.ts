import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()

  let query = supabaseAdmin
    .from('users')
    .select('id, handle, name, bio, avatar_color, avatar_url, source_rate, post_count, follower_count, is_admin, created_at')
    .eq('is_banned', false)

  if (search && search.length > 0) {
    // Remove leading @ if user typed it
    const clean = search.startsWith('@') ? search.slice(1) : search
    query = query.or(`handle.ilike.%${clean}%,name.ilike.%${clean}%`)
  } else {
    query = query.order('follower_count', { ascending: false })
  }

  const { data: users, error } = await query.limit(30)

  if (error) {
    console.error('Users fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  let followingIds = new Set<string>()
  if (payload) {
    const { data: follows } = await supabaseAdmin
      .from('follows')
      .select('following_id')
      .eq('follower_id', payload.userId)
    followingIds = new Set(follows?.map(f => f.following_id) || [])
  }

  const enriched = (users || [])
    .filter(u => u.id !== payload?.userId)
    .map(u => ({ ...u, isFollowing: followingIds.has(u.id) }))

  return NextResponse.json({ data: enriched })
}
