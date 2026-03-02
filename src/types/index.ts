export interface User {
  id: string
  email: string
  handle: string
  name: string
  bio: string
  avatar_color: string
  source_rate: number
  post_count: number
  follower_count: number
  following_count: number
  created_at: string
}

export interface PostSource {
  id: string
  post_id: string
  url: string
  domain: string
  match_status: 'match' | 'partial' | 'mismatch' | 'unknown'
  match_score: number
  is_trusted: boolean
}

export interface Post {
  id: string
  user_id: string
  content: string
  category: string
  claim_detected: boolean
  like_count: number
  comment_count: number
  share_count: number
  created_at: string
  // Joined fields
  author?: User
  sources?: PostSource[]
  liked?: boolean
  bookmarked?: boolean
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}
