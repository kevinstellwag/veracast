import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json()
  const allowed = ['name', 'bio', 'avatar_url', 'avatar_color', 'banner_color', 'website', 'location']
  const updates: Record<string, string> = {}

  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .update(updates)
    .eq('id', payload.userId)
    .select('id, email, handle, name, bio, avatar_color, avatar_url, banner_color, website, location, source_rate, post_count, follower_count, following_count, is_admin, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ data: user })
}
