'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Post } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const CLAIM_TRIGGERS = [
  { name: 'breaking',  rx: /\b(breaking|just in|confirmed|urgent|developing|alert)\b/i },
  { name: 'statistic', rx: /\b\d+[\.,]?\d*\s*(%|percent|million|billion)\b/i },
  { name: 'study',     rx: /\b(new study|research shows?|scientists? (say|find|warn)|according to|data shows?)\b/i },
  { name: 'political', rx: /\b(government|minister|president|parliament|EU|NATO|court|vote|election|policy)\b/i },
  { name: 'event',     rx: /\b(crash|accident|fire|flood|storm|earthquake|explosion|closure|strike|arrested|killed|injured)\b/i },
  { name: 'health',    rx: /\b(vaccine|virus|cancer|disease|hospital|WHO|outbreak|pandemic)\b/i },
  { name: 'infra',     rx: /\b(highway|motorway|road|bridge|tunnel|railway|airport|A\d+|N\d+)\b/i },
  { name: 'economic',  rx: /\b(inflation|GDP|recession|stock market|interest rate|unemployment|economy)\b/i },
]
const EXEMPT_CATS = new Set(['Opinion', 'Meme', 'Lifestyle'])
const CATS = ['News', 'Science', 'Opinion', 'Meme', 'Lifestyle']

interface SourceState {
  url: string
  status: 'idle' | 'loading' | 'match' | 'partial' | 'mismatch' | 'error'
  score: number
  domain: string
  trusted: boolean
  matchedKws: string[]
  missedKws: string[]
  errorMsg?: string
}

const emptySource = (): SourceState => ({
  url: '', status: 'idle', score: 0, domain: '', trusted: false, matchedKws: [], missedKws: []
})

interface Props { onPost: (post: Post) => void }

export default function Compose({ onPost }: Props) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [cat, setCat] = useState('Meme')
  const [claimKws, setClaimKws] = useState<string[]>([])
  const [claimDetected, setClaimDetected] = useState(false)
  const [sources, setSources] = useState<[SourceState, SourceState]>([emptySource(), emptySource()])
  const [showSrc2, setShowSrc2] = useState(false)
  const [posting, setPosting] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageCaption, setImageCaption] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const timers = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([null, null])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const kws: string[] = []
    let detected = false
    for (const t of CLAIM_TRIGGERS) {
      const m = text.match(t.rx)
      if (m) { kws.push(m[0]); detected = true }
    }
    setClaimKws(kws)
    setClaimDetected(detected)
  }, [text])

  const isExempt = EXEMPT_CATS.has(cat)
  const needsSource = claimDetected && !isExempt
  const hasValidSource = sources.some(s => s.status === 'match' || s.status === 'partial')
  const canPost = (text.trim().length > 0 || imageUrl) && (!needsSource || hasValidSource) && !posting && !imageUploading

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageUploading(true)
    setImagePreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('vc_token')}` },
      body: formData,
    })
    const json = await res.json()
    if (json.data?.url) {
      setImageUrl(json.data.url)
    } else {
      setImagePreview(null)
      alert(json.error || 'Upload failed')
    }
    setImageUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function verifySrc(idx: 0 | 1, url: string) {
    if (!url.startsWith('http')) {
      setSources(prev => { const n = [...prev] as [SourceState, SourceState]; n[idx] = { ...n[idx], status: 'error', errorMsg: 'Enter a full URL starting with https://' }; return n })
      return
    }
    setSources(prev => { const n = [...prev] as [SourceState, SourceState]; n[idx] = { ...n[idx], status: 'loading' }; return n })
    const { ok, data, error } = await api.post('/api/source-verify', { url, postText: text })
    if (!ok || !data) {
      setSources(prev => { const n = [...prev] as [SourceState, SourceState]; n[idx] = { ...n[idx], status: 'error', errorMsg: error || 'Could not verify' }; return n })
      return
    }
    setSources(prev => {
      const n = [...prev] as [SourceState, SourceState]
      n[idx] = { url, status: data.status, score: data.score, domain: data.domain, trusted: data.trusted, matchedKws: data.matchedKeywords || [], missedKws: data.missedKeywords || [] }
      return n
    })
  }

  function handleSrcChange(idx: 0 | 1, val: string) {
    setSources(prev => { const n = [...prev] as [SourceState, SourceState]; n[idx] = { ...n[idx], url: val, status: 'idle' }; return n })
    if (timers.current[idx]) clearTimeout(timers.current[idx]!)
    if (val.length > 8) timers.current[idx] = setTimeout(() => verifySrc(idx, val.trim()), 900)
  }

  async function handlePost() {
    if (!canPost || !user) return
    setPosting(true)

    const validSources = sources
      .filter(s => s.url && s.status !== 'idle' && s.status !== 'error')
      .map(s => ({ url: s.url, domain: s.domain, match_status: s.status, match_score: s.score, is_trusted: s.trusted }))

    const { ok, data, error } = await api.post('/api/posts', {
      content: text.trim(),
      category: cat,
      claim_detected: claimDetected,
      sources: validSources,
      image_url: imageUrl || undefined,
      image_caption: imageCaption.trim() || undefined,
    })

    if (ok && data) {
      onPost(data)
      setText('')
      setSources([emptySource(), emptySource()])
      setShowSrc2(false)
      setCat('Meme')
      setImageUrl(null)
      setImagePreview(null)
      setImageCaption('')
    } else {
      alert(error || 'Failed to post')
    }
    setPosting(false)
  }

  if (!user) return null

  return (
    <div className="bg-ink rounded-xl p-5 mb-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />

      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {user.avatar_url
            ? <img src={user.avatar_url} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: user.avatar_color }}>
                {user.name.slice(0, 2).toUpperCase()}
              </div>
          }
        </div>

        <div className="flex-1">
          <textarea
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3.5 py-3 text-sm text-paper placeholder-white/30 resize-none outline-none focus:border-white/25 transition-colors font-sans leading-relaxed"
            placeholder="What's happening? Share news, facts, or anything on your mind…"
            maxLength={500}
            rows={3}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          {/* Image preview */}
          {imagePreview && (
            <div className="mt-2 relative rounded-xl overflow-hidden border border-white/10">
              <img src={imagePreview} alt="preview" className="w-full max-h-64 object-cover" />
              {imageUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white text-sm ml-3">Uploading…</span>
                </div>
              )}
              {!imageUploading && (
                <>
                  <button onClick={() => { setImageUrl(null); setImagePreview(null); setImageCaption('') }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full text-sm hover:bg-black/80 transition-colors">
                    ✕
                  </button>
                  <input
                    type="text"
                    placeholder="Add a caption… (optional)"
                    className="w-full bg-black/50 text-white text-xs px-3 py-2 placeholder-white/40 outline-none border-t border-white/10"
                    value={imageCaption}
                    onChange={e => setImageCaption(e.target.value)}
                    maxLength={200}
                  />
                </>
              )}
            </div>
          )}

          {/* Claim detector */}
          {text.trim() && (
            <div className={`mt-2.5 px-3 py-2 rounded-lg text-xs flex gap-2 items-start
              ${isExempt ? 'bg-amber-900/20 border border-amber-600/30 text-amber-300'
              : claimDetected ? 'bg-red-900/20 border border-red-600/30 text-red-300'
              : 'bg-emerald-900/20 border border-emerald-600/30 text-emerald-300'}`}>
              <span className="text-sm flex-shrink-0">{isExempt ? '✅' : claimDetected ? '⚠️' : '✅'}</span>
              <div className="leading-relaxed">
                {isExempt ? <><strong>Exempt</strong> — tagged as {cat}, no source required.</>
                : claimDetected ? <>
                    <strong>Factual claim detected.</strong> Add a source that covers this topic.
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {claimKws.map(k => <span key={k} className="bg-red-900/30 border border-red-600/40 text-red-300 font-mono text-[9px] px-1.5 py-0.5 rounded">{k}</span>)}
                    </div>
                  </>
                : <><strong>No factual claim detected.</strong> Post freely.</>
                }
              </div>
            </div>
          )}

          {/* Sources */}
          {(!isExempt || sources[0].url) && (
            <div className="mt-2.5 space-y-2">
              <div className="text-[9px] font-mono text-gold uppercase tracking-widest">Source Verification</div>
              {[0, 1].map(i => {
                if (i === 1 && !showSrc2) return null
                const s = sources[i as 0 | 1]
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <span className="font-mono text-[9px] text-gold bg-gold/15 border border-gold/30 rounded w-5 h-5 flex items-center justify-center flex-shrink-0 mt-2">{i + 1}</span>
                    <div className="flex-1">
                      <input type="url"
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 font-mono text-[11px] text-paper placeholder-white/20 outline-none focus:border-gold/40 transition-colors"
                        placeholder="https://example.com/article…"
                        value={s.url}
                        onChange={e => handleSrcChange(i as 0 | 1, e.target.value)}
                      />
                      {s.status !== 'idle' && (
                        <div className={`mt-1.5 px-2.5 py-2 rounded-md text-[11px] flex gap-2 items-start
                          ${s.status === 'loading' ? 'bg-slate-800/50 border border-slate-600/30 text-slate-400'
                          : s.status === 'match' ? 'bg-emerald-900/20 border border-emerald-500/30'
                          : s.status === 'partial' ? 'bg-amber-900/20 border border-amber-500/30'
                          : 'bg-red-900/20 border border-red-500/30'}`}>
                          {s.status === 'loading'
                            ? <><span className="w-3 h-3 border border-slate-500 border-t-slate-300 rounded-full animate-spin flex-shrink-0 mt-0.5 inline-block"/><span>Verifying…</span></>
                            : <>
                                <span className="flex-shrink-0">{s.status === 'match' ? '✅' : s.status === 'partial' ? '⚠️' : '❌'}</span>
                                <div>
                                  <div className={`font-semibold ${s.status === 'match' ? 'text-emerald-400' : s.status === 'partial' ? 'text-amber-400' : 'text-red-400'}`}>
                                    {s.status === 'error' ? s.errorMsg : `${s.domain}${s.trusted ? ' ✓' : ''} — ${s.score}% match`}
                                  </div>
                                  {s.matchedKws.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {s.matchedKws.map(k => <span key={k} className="bg-emerald-900/30 text-emerald-400 border border-emerald-600/30 font-mono text-[9px] px-1 py-0.5 rounded">✓ {k}</span>)}
                                      {s.missedKws.map(k => <span key={k} className="bg-slate-800/50 text-slate-500 border border-slate-600/30 font-mono text-[9px] px-1 py-0.5 rounded">✗ {k}</span>)}
                                    </div>
                                  )}
                                </div>
                              </>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {!showSrc2 && <button onClick={() => setShowSrc2(true)} className="text-xs text-gold hover:text-gold/80 transition-colors">+ Add second source</button>}
            </div>
          )}

          {/* Category + toolbar */}
          <div className="flex flex-wrap gap-1.5 mt-3 items-center">
            <span className="text-[10px] text-white/30 mr-0.5">Tag:</span>
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all
                  ${cat === c ? 'border-gold text-gold bg-gold/10' : 'border-white/12 text-white/40 hover:border-white/30 hover:text-white/70'}`}>
                {c}
              </button>
            ))}

            {/* Image upload button */}
            <button onClick={() => fileRef.current?.click()}
              disabled={imageUploading}
              className="ml-auto px-3 py-1 rounded text-[11px] font-medium border border-white/12 text-white/40 hover:border-white/30 hover:text-white/70 transition-all flex items-center gap-1.5 disabled:opacity-40"
              title="Add image">
              📷 <span>Photo</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3.5">
            <span className={`font-mono text-[11px] ${text.length > 420 ? 'text-red-400' : 'text-white/30'}`}>
              {text.length} / 500
            </span>
            <div className="flex items-center gap-2">
              {needsSource && !hasValidSource && <span className="text-[10px] text-red-400">⚠ source required</span>}
              <button onClick={handlePost} disabled={!canPost}
                className="px-6 py-2 bg-rust text-white rounded-lg font-serif font-bold text-sm hover:bg-rust2 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:-translate-y-px active:translate-y-0">
                {posting ? 'Publishing…' : 'Publish →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
