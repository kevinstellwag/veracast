import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/conversations — list all conversations for current user
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: memberships } = await supabaseAdmin
    .from('conversation_members')
    .select('conversation_id, last_read_at')
    .eq('user_id', payload.userId)

  if (!memberships || memberships.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const convIds = memberships.map(m => m.conversation_id)

  const { data: convs } = await supabaseAdmin
    .from('conversations')
    .select(`
      id, name, is_group, avatar_url, created_at, last_message_at,
      members:conversation_members(
        user_id, role, last_read_at,
        user:users!user_id(id, handle, name, avatar_color, avatar_url)
      )
    `)
    .in('id', convIds)
    .order('last_message_at', { ascending: false })

  if (!convs) return NextResponse.json({ data: [] })

  // Get last message + unread count for each
  const enriched = await Promise.all(convs.map(async (conv) => {
    const membership = memberships.find(m => m.conversation_id === conv.id)

    const { data: lastMsgs } = await supabaseAdmin
      .from('messages')
      .select('id, content, user_id, created_at, author:users!user_id(name, handle)')
      .eq('conversation_id', conv.id)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)

    const { count: unread } = await supabaseAdmin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .eq('deleted', false)
      .neq('user_id', payload.userId)
      .gt('created_at', membership?.last_read_at || '1970-01-01')

    return {
      ...conv,
      last_message: lastMsgs?.[0] || null,
      unread_count: unread || 0,
    }
  }))

  return NextResponse.json({ data: enriched })
}

// POST /api/conversations — start a DM or create a group
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { targetUserId, isGroup, name, memberIds } = await req.json()

  // DM — check if one already exists
  if (!isGroup && targetUserId) {
    const { data: myConvs } = await supabaseAdmin
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', payload.userId)

    if (myConvs && myConvs.length > 0) {
      const { data: theirConvs } = await supabaseAdmin
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', targetUserId)
        .in('conversation_id', myConvs.map(c => c.conversation_id))

      if (theirConvs && theirConvs.length > 0) {
        // Check that the shared conv is a DM (not a group)
        for (const c of theirConvs) {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id, is_group')
            .eq('id', c.conversation_id)
            .eq('is_group', false)
            .single()
          if (conv) return NextResponse.json({ data: { id: conv.id, existing: true } })
        }
      }
    }

    // Create new DM
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .insert({ is_group: false, created_by: payload.userId })
      .select('id')
      .single()

    if (!conv) return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })

    await supabaseAdmin.from('conversation_members').insert([
      { conversation_id: conv.id, user_id: payload.userId, role: 'admin' },
      { conversation_id: conv.id, user_id: targetUserId, role: 'member' },
    ])

    // Notify the other user
    await supabaseAdmin.from('notifications').insert({
      user_id: targetUserId,
      actor_id: payload.userId,
      type: 'message',
      message: 'started a conversation with you',
    })

    return NextResponse.json({ data: { id: conv.id, existing: false } }, { status: 201 })
  }

  // Group chat
  if (isGroup) {
    if (!name?.trim()) return NextResponse.json({ error: 'Group name required' }, { status: 400 })

    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .insert({ is_group: true, name: name.trim(), created_by: payload.userId })
      .select('id')
      .single()

    if (!conv) return NextResponse.json({ error: 'Failed to create group' }, { status: 500 })

    const allMembers = [...new Set([payload.userId, ...(memberIds || [])])]
    await supabaseAdmin.from('conversation_members').insert(
      allMembers.map(uid => ({
        conversation_id: conv.id,
        user_id: uid,
        role: uid === payload.userId ? 'admin' : 'member',
      }))
    )

    return NextResponse.json({ data: { id: conv.id } }, { status: 201 })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
