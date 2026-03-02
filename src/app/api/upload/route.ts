import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, WebP, GIF allowed' }, { status: 400 })

    const ext = file.name.split('.').pop() || 'jpg'
    const path = `avatars/${payload.userId}-${Date.now()}.${ext}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from('veracast-media')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed — make sure the "veracast-media" storage bucket exists in Supabase' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('veracast-media')
      .getPublicUrl(path)

    return NextResponse.json({ data: { url: publicUrl } })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
