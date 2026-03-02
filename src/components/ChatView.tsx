'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Conversation, Message, User, ChatInvite } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

// ── Avatar helper ──────────────────────────────────────────
function MiniAvatar({ user, size = 8 }: { user: { name: string; avatar_color: string; avatar_url?: string | null }; size?: number }) {
  const sz = `w-${size} h-${size}`
  if (user.avatar_url) return <img src={user.avatar_url} className={`${sz} rounded-full object-cover flex-shrink-0`} alt={user.name} />
  return (
    <div className={`${sz} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
      style={{ background: user.avatar_color, fontSize: size < 8 ? '10px' : '12px' }}>
      {user.name.slice(0, 2).toUpperCase()}
    </div>
  )
}

// ── New conversation modal ─────────────────────────────────
function NewChatModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [mode, setMode] = useState<'dm' | 'group'>('dm')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [selected, setSelected] = useState<User[]>([])
  const [groupName, setGroupName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (search.length < 2) { setUsers([]); return }
    api.get(`/api/users?search=${encodeURIComponent(search)}`).then(({ data }) => setUsers(data || []))
  }, [search])

  async function create() {
    if (selected.length === 0) return
    setLoading(true)
    if (mode === 'dm') {
      const { ok, data } = await api.post('/api/conversations', { targetUserId: selected[0].id })
      if (ok && data) onCreated(data.id)
    } else {
      if (!groupName.trim()) { setLoading(false); return }
      const { ok, data } = await api.post('/api/conversations', {
        isGroup: true,
        name: groupName,
        memberIds: selected.map(u => u.id),
      })
      if (ok && data) onCreated(data.id)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-ink px-5 py-4 flex items-center justify-between">
          <h3 className="font-serif font-bold text-paper">New Message</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-paper">✕</button>
        </div>
        <div className="p-5">
          {/* DM / Group tabs */}
          <div className="flex gap-0 mb-4 border border-stone-200 rounded-lg overflow-hidden">
            {(['dm', 'group'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-semibold transition-all ${mode === m ? 'bg-ink text-paper' : 'text-stone-500 hover:text-stone-800'}`}>
                {m === 'dm' ? '💬 Direct Message' : '👥 Group Chat'}
              </button>
            ))}
          </div>

          {mode === 'group' && (
            <input type="text" placeholder="Group name…"
              className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm mb-3 outline-none focus:border-rust"
              value={groupName} onChange={e => setGroupName(e.target.value)} />
          )}

          <input type="text" placeholder="Search by name or @handle…"
            className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm mb-3 outline-none focus:border-rust"
            value={search} onChange={e => setSearch(e.target.value)} />

          {/* Search results */}
          {users.length > 0 && (
            <div className="border border-stone-200 rounded-lg overflow-hidden mb-3 max-h-48 overflow-y-auto">
              {users.map(u => (
                <button key={u.id} onClick={() => {
                  if (mode === 'dm') setSelected([u])
                  else setSelected(prev => prev.find(p => p.id === u.id) ? prev.filter(p => p.id !== u.id) : [...prev, u])
                }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0 ${selected.find(s => s.id === u.id) ? 'bg-rust/5' : ''}`}>
                  <MiniAvatar user={u} />
                  <div>
                    <div className="text-sm font-semibold">{u.name}</div>
                    <div className="text-xs text-stone-400 font-mono">@{u.handle}</div>
                  </div>
                  {selected.find(s => s.id === u.id) && <span className="ml-auto text-rust">✓</span>}
                </button>
              ))}
            </div>
          )}

          {/* Selected chips */}
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selected.map(u => (
                <span key={u.id} className="flex items-center gap-1.5 bg-ink text-paper text-xs px-2.5 py-1 rounded-full">
                  {u.name}
                  <button onClick={() => setSelected(p => p.filter(x => x.id !== u.id))} className="hover:text-rust2 transition-colors">✕</button>
                </span>
              ))}
            </div>
          )}

          <button onClick={create} disabled={loading || selected.length === 0 || (mode === 'group' && !groupName.trim())}
            className="w-full py-2.5 bg-rust text-white rounded-lg font-semibold text-sm hover:bg-rust2 disabled:opacity-40 transition-colors">
            {loading ? 'Creating…' : mode === 'dm' ? 'Start Chat' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Invite to group modal ──────────────────────────────────
function InviteModal({ conv, onClose }: { conv: Conversation; onClose: () => void }) {
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<User[]>([])
  const [sent, setSent] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (search.length < 2) { setUsers([]); return }
    api.get(`/api/users?search=${encodeURIComponent(search)}`).then(({ data }) => {
      const memberIds = new Set(conv.members?.map(m => m.user_id) || [])
      setUsers((data || []).filter((u: User) => !memberIds.has(u.id)))
    })
  }, [search, conv.members])

  async function invite(u: User) {
    const { ok } = await api.post('/api/conversations/invites', { action: 'send', convId: conv.id, targetUserId: u.id })
    if (ok) setSent(p => new Set([...p, u.id]))
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-ink px-5 py-4 flex items-center justify-between">
          <h3 className="font-serif font-bold text-paper">Invite to Group</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-paper">✕</button>
        </div>
        <div className="p-5">
          <input type="text" placeholder="Search users…"
            className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm mb-3 outline-none focus:border-rust"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {users.map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                <MiniAvatar user={u} />
                <div className="flex-1">
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-xs text-stone-400 font-mono">@{u.handle}</div>
                </div>
                <button onClick={() => invite(u)} disabled={sent.has(u.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${sent.has(u.id) ? 'bg-sage2/20 text-sage2' : 'bg-rust text-white hover:bg-rust2'}`}>
                  {sent.has(u.id) ? 'Invited ✓' : 'Invite'}
                </button>
              </div>
            ))}
            {search.length >= 2 && users.length === 0 && <div className="text-sm text-stone-400 text-center py-4">No users found</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────
function Bubble({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const t = new Date(msg.created_at)
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  if (msg.deleted) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
        <span className="text-xs text-stone-400 italic px-3 py-1.5">Message deleted</span>
      </div>
    )
  }

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 gap-2 items-end`}>
      {!isMe && msg.author && <MiniAvatar user={msg.author} size={6} />}
      <div className={`max-w-[72%] group`}>
        {!isMe && msg.author && (
          <div className="text-[10px] text-stone-400 mb-0.5 ml-1 font-mono">@{msg.author.handle}</div>
        )}
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words
          ${isMe
            ? 'bg-ink text-paper rounded-br-sm'
            : 'bg-white border border-stone-200 text-stone-900 rounded-bl-sm shadow-sm'}`}>
          {msg.content}
        </div>
        <div className={`text-[9px] text-stone-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'ml-1'}`}>{time}</div>
      </div>
    </div>
  )
}

// ── Chat window ────────────────────────────────────────────
function ChatWindow({ conv, onInvite }: { conv: Conversation; onInvite: () => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    const { ok, data } = await api.get(`/api/messages?convId=${conv.id}`)
    if (ok && data) setMessages(data)
    setLoading(false)
  }, [conv.id])

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 3000) // poll every 3s
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!text.trim() || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    const { ok, data } = await api.post('/api/messages', { convId: conv.id, content })
    if (ok && data) setMessages(prev => [...prev, data])
    setSending(false)
  }

  // Get the other person's name for DM title
  const title = conv.is_group
    ? conv.name
    : conv.members?.find(m => m.user_id !== user?.id)?.user?.name || 'Chat'

  const otherUser = !conv.is_group
    ? conv.members?.find(m => m.user_id !== user?.id)?.user
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200 bg-white flex-shrink-0">
        {otherUser
          ? <MiniAvatar user={otherUser} />
          : <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
              {(conv.name || 'G').slice(0, 2).toUpperCase()}
            </div>
        }
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-stone-900 truncate">{title}</div>
          {conv.is_group && (
            <div className="text-[10px] text-stone-400">{conv.members?.length || 0} members</div>
          )}
        </div>
        {conv.is_group && (
          <button onClick={onInvite}
            className="text-xs font-semibold text-stone-500 hover:text-rust transition-colors px-2 py-1 rounded border border-stone-200 hover:border-rust">
            + Invite
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0">
        {loading
          ? <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
          : messages.length === 0
          ? <div className="text-center py-12 text-stone-400 text-sm">
              <div className="text-3xl mb-2">👋</div>
              Say hello!
            </div>
          : messages.map(m => <Bubble key={m.id} msg={m} isMe={m.user_id === user?.id} />)
        }
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-stone-200 bg-white flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm resize-none outline-none focus:border-rust transition-colors max-h-32"
            placeholder="Type a message…"
            rows={1}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          />
          <button onClick={send} disabled={!text.trim() || sending}
            className="w-10 h-10 bg-rust text-white rounded-xl flex items-center justify-center hover:bg-rust2 disabled:opacity-40 transition-colors flex-shrink-0 text-lg">
            ↑
          </button>
        </div>
        <div className="text-[10px] text-stone-400 mt-1 ml-1">Enter to send · Shift+Enter for new line</div>
      </div>
    </div>
  )
}

// ── Main chat view ─────────────────────────────────────────
export default function ChatView() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [pendingInvites, setPendingInvites] = useState<ChatInvite[]>([])
  const [showNewChat, setShowNewChat] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadConvs = useCallback(async () => {
    const [{ data: convData }, { data: inviteData }] = await Promise.all([
      api.get('/api/conversations'),
      api.get('/api/conversations/invites'),
    ])
    if (convData) setConversations(convData)
    if (inviteData) setPendingInvites(inviteData)
    setLoading(false)
  }, [])

  useEffect(() => { loadConvs() }, [loadConvs])

  async function respondToInvite(inviteId: string, response: 'accepted' | 'declined') {
    const { ok, data } = await api.post('/api/conversations/invites', { action: 'respond', inviteId, response })
    if (ok) {
      setPendingInvites(p => p.filter(i => i.id !== inviteId))
      if (response === 'accepted' && data?.convId) {
        loadConvs()
      }
    }
  }

  function getConvName(conv: Conversation) {
    if (conv.is_group) return conv.name || 'Group'
    const other = conv.members?.find(m => m.user_id !== user?.id)
    return other?.user?.name || 'Chat'
  }

  function getConvAvatar(conv: Conversation) {
    if (conv.is_group) return null
    return conv.members?.find(m => m.user_id !== user?.id)?.user || null
  }

  return (
    <div className="flex gap-0 bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>

      {/* Sidebar */}
      <div className="w-72 border-r border-stone-200 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between bg-ink">
          <div className="font-serif font-bold text-paper text-sm">Messages</div>
          <button onClick={() => setShowNewChat(true)}
            className="w-7 h-7 rounded-full bg-rust text-white flex items-center justify-center text-lg hover:bg-rust2 transition-colors">
            +
          </button>
        </div>

        {/* Pending invites */}
        {pendingInvites.length > 0 && (
          <div className="border-b border-stone-200">
            <div className="px-4 py-2 text-[10px] font-mono text-stone-400 uppercase tracking-wide bg-stone-50">
              Pending Invites ({pendingInvites.length})
            </div>
            {pendingInvites.map(inv => (
              <div key={inv.id} className="px-3 py-2.5 border-b border-stone-100 bg-amber-50/50">
                <div className="text-xs text-stone-700 mb-2">
                  <strong>{inv.inviter?.name}</strong> invited you to{' '}
                  <strong>{inv.conversation?.name || 'a chat'}</strong>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => respondToInvite(inv.id, 'accepted')}
                    className="flex-1 py-1 bg-sage2 text-white text-xs rounded font-semibold hover:opacity-90">Accept</button>
                  <button onClick={() => respondToInvite(inv.id, 'declined')}
                    className="flex-1 py-1 border border-stone-300 text-stone-600 text-xs rounded font-semibold hover:bg-stone-100">Decline</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading
            ? <div className="text-center py-8 text-stone-400 text-sm">Loading…</div>
            : conversations.length === 0
            ? <div className="text-center py-12 px-4">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-sm font-semibold text-stone-700 mb-1">No conversations yet</div>
                <div className="text-xs text-stone-400">Click + to start chatting</div>
              </div>
            : conversations.map(conv => {
                const name = getConvName(conv)
                const avatarUser = getConvAvatar(conv)
                const isActive = activeConv?.id === conv.id
                return (
                  <button key={conv.id} onClick={() => setActiveConv(conv)}
                    className={`w-full px-3 py-3 flex items-center gap-3 border-b border-stone-100 text-left hover:bg-stone-50 transition-colors ${isActive ? 'bg-rust/5 border-l-2 border-l-rust' : ''}`}>
                    {avatarUser
                      ? <MiniAvatar user={avatarUser} />
                      : <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {name.slice(0, 2).toUpperCase()}
                        </div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-stone-900 truncate">{name}</div>
                        {conv.unread_count > 0 && (
                          <span className="bg-rust text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">{conv.unread_count}</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 truncate">
                        {conv.last_message?.content || 'No messages yet'}
                      </div>
                    </div>
                  </button>
                )
              })
          }
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0">
        {activeConv
          ? <ChatWindow conv={activeConv} onInvite={() => setShowInvite(true)} />
          : <div className="h-full flex flex-col items-center justify-center text-stone-400">
              <div className="text-5xl mb-3">💬</div>
              <div className="font-serif text-xl font-bold text-stone-700 mb-1">Your Messages</div>
              <div className="text-sm">Select a conversation or start a new one</div>
              <button onClick={() => setShowNewChat(true)}
                className="mt-4 px-5 py-2.5 bg-rust text-white rounded-lg text-sm font-semibold hover:bg-rust2 transition-colors">
                New Message
              </button>
            </div>
        }
      </div>

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onCreated={id => {
          setShowNewChat(false)
          loadConvs().then(() => {
            setConversations(prev => {
              const found = prev.find(c => c.id === id)
              if (found) setActiveConv(found)
              return prev
            })
          })
        }} />
      )}

      {showInvite && activeConv && (
        <InviteModal conv={activeConv} onClose={() => setShowInvite(false)} />
      )}
    </div>
  )
}
