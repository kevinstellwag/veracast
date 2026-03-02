import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// POST /api/follow — { targetUserId } — toggles follow
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  if (targetUserId === payload.userId) return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('follows')
    .select('follower_id')
    .eq('follower_id', payload.userId)
    .eq('following_id', targetUserId)
    .single()

  if (existing) {
    // Unfollow
    await supabaseAdmin.from('follows').delete()
      .eq('follower_id', payload.userId)
      .eq('following_id', targetUserId)

    // Update counts
    await Promise.all([
      supabaseAdmin.from('users').select('following_count').eq('id', payload.userId).single()
        .then(({ data: u }) => supabaseAdmin.from('users').update({ following_count: Math.max(0, (u?.following_count || 1) - 1) }).eq('id', payload.userId)),
      supabaseAdmin.from('users').select('follower_count').eq('id', targetUserId).single()
        .then(({ data: u }) => supabaseAdmin.from('users').update({ follower_count: Math.max(0, (u?.follower_count || 1) - 1) }).eq('id', targetUserId)),
    ])

    return NextResponse.json({ data: { following: false } })
  } else {
    // Follow
    await supabaseAdmin.from('follows').insert({ follower_id: payload.userId, following_id: targetUserId })

    await Promise.all([
      supabaseAdmin.from('users').select('following_count').eq('id', payload.userId).single()
        .then(({ data: u }) => supabaseAdmin.from('users').update({ following_count: (u?.following_count || 0) + 1 }).eq('id', payload.userId)),
      supabaseAdmin.from('users').select('follower_count').eq('id', targetUserId).single()
        .then(({ data: u }) => supabaseAdmin.from('users').update({ follower_count: (u?.follower_count || 0) + 1 }).eq('id', targetUserId)),
    ])

    return NextResponse.json({ data: { following: true } })
  }
}
