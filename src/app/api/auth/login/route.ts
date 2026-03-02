import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    if (error || !user) {
      return NextResponse.json({ error: 'No account found with that email' }, { status: 401 })
    }

    if (user.is_banned) {
      return NextResponse.json({ error: 'This account has been suspended' }, { status: 403 })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    const token = signToken({ userId: user.id, email: user.email, handle: user.handle })
    const { password_hash: _, ...safeUser } = user

    const res = NextResponse.json({ data: { user: safeUser, token } })
    res.cookies.set('veracast_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
    return res
  } catch (e) {
    console.error('Login error:', e)
    return NextResponse.json({ error: 'Server error — please try again' }, { status: 500 })
  }
}
