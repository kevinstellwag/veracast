import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// GET /api/messages?convId=xxx
export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const convId = searchParams.get('convId')
  if (!convId) return NextResponse.json({ error: 'convId required' }, { status: 400 })

  // Verify membership
  const { data: member } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', convId)
    .eq('user_id', payload.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Not a member of this conversation' }, { status: 403 })

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select(`
      id, content, deleted, created_at, user_id,
      author:users!user_id(id, handle, name, avatar_color, avatar_url)
    `)
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(100)

  // Mark as read
  await supabaseAdmin
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', convId)
    .eq('user_id', payload.userId)

  return NextResponse.json({ data: messages || [] })
}

// POST /api/messages — send a message
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { convId, content } = await req.json()
  if (!convId || !content?.trim()) return NextResponse.json({ error: 'convId and content required' }, { status: 400 })

  // Verify membership
  const { data: member } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', convId)
    .eq('user_id', payload.userId)
    .single()

  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 })

  const { data: message } = await supabaseAdmin
    .from('messages')
    .insert({ conversation_id: convId, user_id: payload.userId, content: content.trim() })
    .select(`
      id, content, deleted, created_at, user_id,
      author:users!user_id(id, handle, name, avatar_color, avatar_url)
    `)
    .single()

  // Update conversation last_message_at
  await supabaseAdmin
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId)

  // Notify other members
  const { data: otherMembers } = await supabaseAdmin
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', convId)
    .neq('user_id', payload.userId)

  if (otherMembers && otherMembers.length > 0) {
    await supabaseAdmin.from('notifications').insert(
      otherMembers.map(m => ({
        user_id: m.user_id,
        actor_id: payload.userId,
        type: 'message',
        message: content.trim().slice(0, 80),
      }))
    )
  }

  return NextResponse.json({ data: message }, { status: 201 })
}
