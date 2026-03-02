import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/conversations/invites — pending invites for current user
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('chat_invites')
    .select(`
      id, status, created_at,
      conversation:conversations(id, name, is_group),
      inviter:users!invited_by(id, handle, name, avatar_color, avatar_url)
    `)
    .eq('invited_user', payload.userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return NextResponse.json({ data: data || [] })
}

// POST /api/conversations/invites — send invite or respond to one
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { action, convId, targetUserId, inviteId, response } = await req.json()

  // Send invite to join a group
  if (action === 'send') {
    const { data: member } = await supabaseAdmin
      .from('conversation_members')
      .select('role')
      .eq('conversation_id', convId)
      .eq('user_id', payload.userId)
      .single()

    if (!member) return NextResponse.json({ error: 'Not a member of this conversation' }, { status: 403 })

    const { data: invite } = await supabaseAdmin
      .from('chat_invites')
      .insert({ conversation_id: convId, invited_by: payload.userId, invited_user: targetUserId })
      .select()
      .single()

    await supabaseAdmin.from('notifications').insert({
      user_id: targetUserId,
      actor_id: payload.userId,
      type: 'message',
      message: 'invited you to a group chat',
    })

    return NextResponse.json({ data: invite }, { status: 201 })
  }

  // Accept / decline invite
  if (action === 'respond' && inviteId) {
    const { data: invite } = await supabaseAdmin
      .from('chat_invites')
      .select('*')
      .eq('id', inviteId)
      .eq('invited_user', payload.userId)
      .single()

    if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

    await supabaseAdmin
      .from('chat_invites')
      .update({ status: response })
      .eq('id', inviteId)

    if (response === 'accepted') {
      await supabaseAdmin.from('conversation_members').insert({
        conversation_id: invite.conversation_id,
        user_id: payload.userId,
        role: 'member',
      })
    }

    return NextResponse.json({ data: { ok: true, convId: response === 'accepted' ? invite.conversation_id : null } })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
