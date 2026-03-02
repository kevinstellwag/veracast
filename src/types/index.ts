export interface User {
  id: string
  email: string
  handle: string
  name: string
  bio: string
  avatar_color: string
  avatar_url?: string | null
  banner_color?: string
  website?: string
  location?: string
  source_rate: number
  post_count: number
  follower_count: number
  following_count: number
  is_verified?: boolean
  is_admin?: boolean
  is_banned?: boolean
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
  image_url?: string | null
  image_caption?: string | null
  like_count: number
  comment_count: number
  share_count: number
  created_at: string
  author?: User
  sources?: PostSource[]
  liked?: boolean
  bookmarked?: boolean
}

export interface Notification {
  id: string
  user_id: string
  actor_id?: string
  type: 'like' | 'follow' | 'mention' | 'message' | 'system'
  post_id?: string
  message?: string
  read: boolean
  created_at: string
  actor?: User
  post?: Post
}

export interface Message {
  id: string
  conversation_id: string
  user_id: string
  content: string
  deleted: boolean
  created_at: string
  author?: User
}

export interface Conversation {
  id: string
  name?: string
  is_group: boolean
  avatar_url?: string
  created_by?: string
  created_at: string
  last_message_at: string
  members?: ConversationMember[]
  last_message?: Message
  unread_count?: number
}

export interface ConversationMember {
  conversation_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
  last_read_at: string
  user?: User
}

export interface ChatInvite {
  id: string
  conversation_id: string
  invited_by: string
  invited_user: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  conversation?: Conversation
  inviter?: User
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  author?: User
}
