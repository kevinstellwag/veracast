import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/notifications
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select(`
      id, type, message, read, created_at, post_id,
      actor:users!actor_id(id, handle, name, avatar_color, avatar_url)
    `)
    .eq('user_id', payload.userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'Failed' }, { status: 500 })

  const unread = (data || []).filter(n => !n.read).length
  return NextResponse.json({ data: { notifications: data || [], unread } })
}

// POST /api/notifications/read — mark all read
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', payload.userId)
    .eq('read', false)

  return NextResponse.json({ data: { ok: true } })
}
