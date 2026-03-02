import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getTokenFromRequest } from '@/lib/auth'

// POST /api/posts/[id]/like — toggle like
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const payload = getTokenFromRequest(req)
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const postId = params.id
  const { action } = await req.json() // 'like' | 'bookmark'

  const table = action === 'bookmark' ? 'bookmarks' : 'likes'
  const countCol = action === 'bookmark' ? null : 'like_count'

  // Check if already exists
  const { data: existing } = await supabaseAdmin
    .from(table)
    .select('user_id')
    .eq('user_id', payload.userId)
    .eq('post_id', postId)
    .single()

  if (existing) {
    // Remove it
    await supabaseAdmin.from(table).delete().eq('user_id', payload.userId).eq('post_id', postId)
    if (countCol) {
      await supabaseAdmin.rpc('decrement_count', { tbl: 'posts', col: countCol, row_id: postId }).catch(() => {
        supabaseAdmin.from('posts').select(countCol).eq('id', postId).single().then(({ data }) => {
          if (data) supabaseAdmin.from('posts').update({ [countCol]: Math.max(0, (data[countCol] || 1) - 1) }).eq('id', postId)
        })
      })
    }
    return NextResponse.json({ data: { active: false } })
  } else {
    // Add it
    await supabaseAdmin.from(table).insert({ user_id: payload.userId, post_id: postId })
    if (countCol) {
      await supabaseAdmin.rpc('increment_count', { tbl: 'posts', col: countCol, row_id: postId }).catch(() => {
        supabaseAdmin.from('posts').select(countCol).eq('id', postId).single().then(({ data }) => {
          if (data) supabaseAdmin.from('posts').update({ [countCol]: (data[countCol] || 0) + 1 }).eq('id', postId)
        })
      })
    }
    return NextResponse.json({ data: { active: true } })
  }
}
