import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { data: comments } = await supabaseAdmin
    .from('comments')
    .select(`
      id, content, created_at, user_id,
      author:users!user_id(id, handle, name, avatar_color, avatar_url, is_verified)
    `)
    .eq('post_id', params.id)
    .order('created_at', { ascending: true })
    .limit(50)

  return NextResponse.json({ data: comments || [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })
  if (content.length > 280) return NextResponse.json({ error: 'Comment too long (max 280 chars)' }, { status: 400 })

  const { data: comment } = await supabaseAdmin
    .from('comments')
    .insert({ post_id: params.id, user_id: payload.userId, content: content.trim() })
    .select(`
      id, content, created_at, user_id,
      author:users!user_id(id, handle, name, avatar_color, avatar_url, is_verified)
    `)
    .single()

  // Increment comment count + notify post author
  await supabaseAdmin.from('posts').select('user_id, comment_count').eq('id', params.id).single()
    .then(({ data: p }) => {
      if (!p) return
      supabaseAdmin.from('posts').update({ comment_count: (p.comment_count || 0) + 1 }).eq('id', params.id)
      if (p.user_id !== payload.userId) {
        supabaseAdmin.from('notifications').insert({
          user_id: p.user_id,
          actor_id: payload.userId,
          type: 'mention',
          post_id: params.id,
          message: 'commented on your post',
        })
      }
    })

  return NextResponse.json({ data: comment }, { status: 201 })
}
