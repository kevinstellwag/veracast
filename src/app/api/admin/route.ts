import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

async function requireAdmin(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return null
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('is_admin, is_banned')
    .eq('id', payload.userId)
    .single()
  if (!user?.is_admin || user?.is_banned) return null
  return payload
}

// GET /api/admin — dashboard stats + recent users/posts
export async function GET(req: NextRequest) {
  const payload = await requireAdmin(req)
  if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [
    { count: totalUsers },
    { count: totalPosts },
    { count: sourcedPosts },
    { count: bannedUsers },
    { data: recentUsers },
    { data: recentPosts },
    { data: flaggedPosts },
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('posts').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('post_sources').select('post_id', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('is_banned', true),
    supabaseAdmin.from('users').select('id, handle, name, email, avatar_color, avatar_url, is_admin, is_banned, post_count, follower_count, created_at').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('posts').select(`
      id, content, category, like_count, created_at,
      author:users!user_id(id, handle, name, avatar_color)
    `).order('created_at', { ascending: false }).limit(20),
    // Posts with low engagement but high share (potential misinfo)
    supabaseAdmin.from('posts').select(`
      id, content, category, like_count, share_count, created_at,
      author:users!user_id(id, handle, name, avatar_color),
      sources:post_sources(id)
    `).eq('claim_detected', true).is('post_sources.id', null).order('created_at', { ascending: false }).limit(10),
  ])

  return NextResponse.json({
    data: {
      stats: {
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        sourcedPosts: sourcedPosts || 0,
        bannedUsers: bannedUsers || 0,
        sourceRate: totalPosts ? Math.round(((sourcedPosts || 0) / totalPosts) * 100) : 0,
      },
      recentUsers: recentUsers || [],
      recentPosts: recentPosts || [],
      flaggedPosts: flaggedPosts || [],
    }
  })
}

// POST /api/admin — admin actions
export async function POST(req: NextRequest) {
  const payload = await requireAdmin(req)
  if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, targetId, reason } = await req.json()

  switch (action) {
    case 'delete_post': {
      await supabaseAdmin.from('posts').delete().eq('id', targetId)
      return NextResponse.json({ data: { ok: true, action: 'post_deleted' } })
    }

    case 'ban_user': {
      await supabaseAdmin.from('users').update({ is_banned: true }).eq('id', targetId)
      await supabaseAdmin.from('notifications').insert({
        user_id: targetId,
        type: 'system',
        message: `Your account has been suspended.${reason ? ' Reason: ' + reason : ''}`,
      })
      return NextResponse.json({ data: { ok: true, action: 'user_banned' } })
    }

    case 'unban_user': {
      await supabaseAdmin.from('users').update({ is_banned: false }).eq('id', targetId)
      await supabaseAdmin.from('notifications').insert({
        user_id: targetId,
        type: 'system',
        message: 'Your account suspension has been lifted.',
      })
      return NextResponse.json({ data: { ok: true, action: 'user_unbanned' } })
    }

    case 'make_admin': {
      await supabaseAdmin.from('users').update({ is_admin: true }).eq('id', targetId)
      return NextResponse.json({ data: { ok: true, action: 'admin_granted' } })
    }

    case 'remove_admin': {
      if (targetId === payload.userId) return NextResponse.json({ error: 'Cannot remove your own admin' }, { status: 400 })
      await supabaseAdmin.from('users').update({ is_admin: false }).eq('id', targetId)
      return NextResponse.json({ data: { ok: true, action: 'admin_removed' } })
    }

    case 'delete_user': {
      if (targetId === payload.userId) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 })
      await supabaseAdmin.from('users').delete().eq('id', targetId)
      return NextResponse.json({ data: { ok: true, action: 'user_deleted' } })
    }

    case 'broadcast': {
      // Send system notification to all users
      const { data: users } = await supabaseAdmin.from('users').select('id').eq('is_banned', false)
      if (users && users.length > 0) {
        await supabaseAdmin.from('notifications').insert(
          users.map(u => ({ user_id: u.id, type: 'system', message: targetId })) // targetId used as message here
        )
      }
      return NextResponse.json({ data: { ok: true, action: 'broadcast_sent', recipients: users?.length || 0 } })
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
