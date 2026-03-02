import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, handle, name, bio, avatar_color, source_rate, post_count, follower_count, following_count, created_at')
    .eq('id', payload.userId)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({ data: user })
}

export async function DELETE() {
  const res = NextResponse.json({ data: { ok: true } })
  res.cookies.set('veracast_token', '', { maxAge: 0, path: '/' })
  return res
}
