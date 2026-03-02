import { NextRequest, NextResponse } from 'next/server'
import { verifySource } from '@/lib/sourceVerify'
import { getTokenFromRequest } from '@/lib/auth'

// POST /api/source-verify  { url, postText }
export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const { url, postText } = await req.json()

    if (!url || !postText) {
      return NextResponse.json({ error: 'url and postText are required' }, { status: 400 })
    }

    if (!url.startsWith('http')) {
      return NextResponse.json({ error: 'URL must start with http:// or https://' }, { status: 400 })
    }

    const result = await verifySource(postText, url)
    return NextResponse.json({ data: result })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
