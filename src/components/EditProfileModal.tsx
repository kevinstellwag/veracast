'use client'
import { useState, useRef } from 'react'
import { User } from '@/types'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const AVATAR_COLORS = [
  '#c0430a','#2851a3','#0a5535','#5a0a80','#1a6a3a',
  '#2a5a8a','#7a1a4a','#3a5a2a','#6a3a00','#1a3a6a',
]
const BANNER_COLORS = [
  '#0d0c0a','#1a1916','#1a2a1a','#1a1a2a','#2a1a0a',
  '#0a1a2a','#2a0a1a','#1a2a2a','#2a2a0a','#0a2a1a',
]

interface Props {
  user: User
  onClose: () => void
  onSave: (user: User) => void
}

export default function EditProfileModal({ user, onClose, onSave }: Props) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio || '')
  const [website, setWebsite] = useState(user.website || '')
  const [location, setLocation] = useState(user.location || '')
  const [avatarColor, setAvatarColor] = useState(user.avatar_color)
  const [bannerColor, setBannerColor] = useState(user.banner_color || '#1a1916')
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.avatar_url || null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')

    // Local preview
    setPreviewUrl(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('vc_token')}` },
        body: formData,
      })
      const json = await res.json()
      if (json.data?.url) {
        setAvatarUrl(json.data.url)
      } else {
        setError(json.error || 'Upload failed')
        setPreviewUrl(user.avatar_url || null)
      }
    } catch {
      setError('Upload failed')
      setPreviewUrl(user.avatar_url || null)
    }
    setUploading(false)
  }

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')

    const { ok, data, error: err } = await api.post('/api/profile', {
      name: name.trim(),
      bio: bio.trim(),
      website: website.trim(),
      location: location.trim(),
      avatar_color: avatarColor,
      banner_color: bannerColor,
      avatar_url: avatarUrl || null,
    })

    if (ok && data) {
      await refreshUser()
      onSave(data)
    } else {
      setError(err || 'Save failed')
    }
    setSaving(false)
  }

  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="bg-ink px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />
          <h2 className="font-serif text-lg font-bold text-paper">Edit Profile</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-paper transition-colors text-xl">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* Banner color */}
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-2 block">Banner Color</label>
            <div className="h-16 rounded-lg mb-2 relative transition-colors" style={{ background: bannerColor }}>
              <div className="absolute inset-0 opacity-10 rounded-lg" style={{ backgroundImage: 'repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(255,255,255,.3) 10px,rgba(255,255,255,.3) 11px)' }} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {BANNER_COLORS.map(c => (
                <button key={c} onClick={() => setBannerColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${bannerColor === c ? 'border-gold scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Avatar */}
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-2 block">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {previewUrl
                  ? <img src={previewUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover border-2 border-stone-200" />
                  : <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl border-2 border-stone-200" style={{ background: avatarColor }}>
                      {initials}
                    </div>
                }
                {uploading && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 bg-ink text-paper text-sm rounded-lg hover:bg-ink2 transition-colors disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload Photo'}
                </button>
                {previewUrl && (
                  <button onClick={() => { setPreviewUrl(null); setAvatarUrl('') }}
                    className="px-4 py-2 border border-stone-300 text-stone-600 text-sm rounded-lg hover:bg-stone-100 transition-colors">
                    Remove
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>

            {/* Fallback color if no photo */}
            {!previewUrl && (
              <div className="mt-3">
                <div className="text-[10px] text-stone-400 mb-2">Or pick an avatar color:</div>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map(c => (
                    <button key={c} onClick={() => setAvatarColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${avatarColor === c ? 'border-gold scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ background: c }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Display Name *</label>
            <input
              type="text"
              className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Bio */}
          <div>
            <label className="text-xs font-semibold text-stone-600 mb-1 block">Bio</label>
            <textarea
              className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors resize-none"
              rows={3}
              placeholder="Tell people about yourself…"
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200}
            />
            <div className="text-right text-[10px] text-stone-400">{bio.length}/200</div>
          </div>

          {/* Website + Location */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Website</label>
              <input
                type="url"
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
                placeholder="https://…"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-600 mb-1 block">Location</label>
              <input
                type="text"
                className="w-full border border-stone-200 rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-rust transition-colors"
                placeholder="Amsterdam, NL"
                value={location}
                onChange={e => setLocation(e.target.value)}
                maxLength={60}
              />
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-stone-200 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-stone-300 text-stone-600 rounded-lg text-sm font-semibold hover:bg-stone-100 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || uploading}
            className="flex-1 py-2.5 bg-rust text-white rounded-lg text-sm font-semibold hover:bg-rust2 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
