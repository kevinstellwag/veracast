import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/users — list users for explore page
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)

  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, handle, name, bio, avatar_color, source_rate, post_count, follower_count')
    .order('follower_count', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })

  // Add isFollowing flag
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
