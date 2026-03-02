import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, handle } = await req.json()

    if (!email || !password || !name || !handle) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const cleanHandle = handle.toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanHandle.length < 3) {
      return NextResponse.json({ error: 'Handle must be at least 3 characters (letters, numbers, underscores)' }, { status: 400 })
    }

    const cleanEmail = email.toLowerCase().trim()

    // Check email uniqueness
    const { data: emailCheck } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (emailCheck) {
      return NextResponse.json({ error: 'That email is already registered' }, { status: 409 })
    }

    // Check handle uniqueness
    const { data: handleCheck } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('handle', cleanHandle)
      .maybeSingle()

    if (handleCheck) {
      return NextResponse.json({ error: 'That handle is already taken' }, { status: 409 })
    }

    const password_hash = await bcrypt.hash(password, 12)

    const COLORS = ['#c0430a','#2851a3','#0a5535','#5a0a80','#1a6a3a','#2a5a8a','#7a1a4a','#3a5a2a']
    const avatar_color = COLORS[Math.floor(Math.random() * COLORS.length)]

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({
        email: cleanEmail,
        handle: cleanHandle,
        name: name.trim(),
        password_hash,
        avatar_color,
        bio: '',
        banner_color: '#1a1916',
      })
      .select('id, email, handle, name, bio, avatar_color, avatar_url, banner_color, source_rate, post_count, follower_count, following_count, is_admin, created_at')
      .single()

    if (error || !user) {
      console.error('Insert error:', error)
      return NextResponse.json({ error: 'Failed to create account — please try again' }, { status: 500 })
    }

    const token = signToken({ userId: user.id, email: user.email, handle: user.handle })

    const res = NextResponse.json({ data: { user, token } }, { status: 201 })
    res.cookies.set('veracast_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch (e) {
    console.error('Register error:', e)
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 })
  }
}
