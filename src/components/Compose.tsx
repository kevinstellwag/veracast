'use client'
import { useState, useRef, useEffect } from 'react'
import { api } from '@/lib/api'
import { Post } from '@/types'
import { useAuth } from '@/hooks/useAuth'

const CLAIM_TRIGGERS = [
  { name: 'breaking',    rx: /\b(breaking|just in|confirmed|urgent|developing|alert)\b/i },
  { name: 'statistic',   rx: /\b\d+[\.,]?\d*\s*(%|percent|million|billion)\b|\b\d+x\s+more\b/i },
  { name: 'study',       rx: /\b(new study|research shows?|scientists? (say|find|warn)|according to|data shows?)\b/i },
  { name: 'political',   rx: /\b(government|minister|president|parliament|EU|NATO|court|vote|election|policy)\b/i },
  { name: 'event',       rx: /\b(crash|accident|fire|flood|storm|earthquake|explosion|closure|shutdown|strike|arrested|killed|injured)\b/i },
  { name: 'health',      rx: /\b(vaccine|virus|cancer|disease|hospital|WHO|outbreak|pandemic|vaccination)\b/i },
  { name: 'infra',       rx: /\b(highway|motorway|road|bridge|tunnel|railway|airport|A\d+|N\d+)\b/i },
  { name: 'economic',    rx: /\b(inflation|GDP|recession|stock market|interest rate|unemployment|economy)\b/i },
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

interface Props {
  onPost: (post: Post) => void
}

export default function Compose({ onPost }: Props) {
  const { user } = useAuth()
  const [text, setText] = useState('')
  const [cat, setCat] = useState('Meme')
  const [claimKws, setClaimKws] = useState<string[]>([])
  const [claimDetected, setClaimDetected] = useState(false)
  const [sources, setSources] = useState<[SourceState, SourceState]>([emptySource(), emptySource()])
  const [showSrc2, setShowSrc2] = useState(false)
  const [posting, setPosting] = useState(false)
  const timers = useRef<[ReturnType<typeof setTimeout> | null, ReturnType<typeof setTimeout> | null]>([null, null])

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
  const canPost = text.trim().length > 0 && (!needsSource || hasValidSource) && !posting

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
      n[idx] = {
        url,
        status: data.status,
        score: data.score,
        domain: data.domain,
        trusted: data.trusted,
        matchedKws: data.matchedKeywords || [],
        missedKws: data.missedKeywords || [],
      }
      return n
    })
  }

  function handleSrcChange(idx: 0 | 1, val: string) {
    setSources(prev => { const n = [...prev] as [SourceState, SourceState]; n[idx] = { ...n[idx], url: val, status: 'idle' }; return n })
    if (timers.current[idx]) clearTimeout(timers.current[idx]!)
    if (val.length > 8) {
      timers.current[idx] = setTimeout(() => verifySrc(idx, val.trim()), 900)
    }
  }

  async function handlePost() {
    if (!canPost || !user) return
    setPosting(true)

    const validSources = sources
      .filter(s => s.url && s.status !== 'idle' && s.status !== 'error')
      .map(s => ({
        url: s.url,
        domain: s.domain,
        match_status: s.status,
        match_score: s.score,
        is_trusted: s.trusted,
      }))

    const { ok, data, error } = await api.post('/api/posts', {
      content: text.trim(),
      category: cat,
      claim_detected: claimDetected,
      sources: validSources,
    })

    if (ok && data) {
      onPost(data)
      setText('')
      setSources([emptySource(), emptySource()])
      setShowSrc2(false)
      setCat('Meme')
    } else {
      alert(error || 'Failed to post')
    }
    setPosting(false)
  }

  if (!user) return null

  const initials = user.name?.slice(0, 2).toUpperCase() || 'YO'

  return (
    <div className="bg-ink rounded-xl p-5 mb-6 relative overflow-hidden">
      {/* gradient top border */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-rust via-gold to-rust" />

      <div className="flex gap-3">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5"
          style={{ background: user.avatar_color || '#c0430a' }}
        >
          {initials}
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

          {/* Claim banner */}
          {text.trim() && (
            <div className={`mt-2.5 px-3 py-2 rounded-lg text-xs flex gap-2 items-start
              ${isExempt
                ? 'bg-amber-900/20 border border-amber-600/30 text-amber-300'
                : claimDetected
                ? 'bg-red-900/20 border border-red-600/30 text-red-300'
                : 'bg-emerald-900/20 border border-emerald-600/30 text-emerald-300'}`}>
              <span className="text-sm flex-shrink-0">{isExempt ? '✅' : claimDetected ? '⚠️' : '✅'}</span>
              <div className="leading-relaxed">
                {isExempt
                  ? <><strong>Exempt</strong> — tagged as {cat}, no source required.</>
                  : claimDetected
                  ? <><strong>Factual claim detected.</strong> Add a source that covers this topic — we verify keywords match.
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {claimKws.map(k => (
                          <span key={k} className="bg-red-900/30 border border-red-600/40 text-red-300 font-mono text-[9px] px-1.5 py-0.5 rounded">{k}</span>
                        ))}
                      </div>
                    </>
                  : <><strong>No specific claim detected.</strong> Post freely or add a source for extra credibility.</>
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
                      <input
                        type="url"
                        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 font-mono text-[11px] text-paper placeholder-white/20 outline-none focus:border-gold/40 transition-colors"
                        placeholder="https://example.com/article-about-this-topic"
                        value={s.url}
                        onChange={e => handleSrcChange(i as 0 | 1, e.target.value)}
                      />
                      {/* Verify result */}
                      {s.status !== 'idle' && (
                        <div className={`mt-1.5 px-2.5 py-2 rounded-md text-[11px] flex gap-2 items-start
                          ${s.status === 'loading' ? 'bg-slate-800/50 border border-slate-600/30 text-slate-400'
                          : s.status === 'match' ? 'bg-emerald-900/20 border border-emerald-500/30'
                          : s.status === 'partial' ? 'bg-amber-900/20 border border-amber-500/30'
                          : 'bg-red-900/20 border border-red-500/30'}`}>
                          {s.status === 'loading'
                            ? <><span className="inline-block w-3 h-3 border border-slate-500 border-t-slate-300 rounded-full animate-spin flex-shrink-0 mt-0.5"/><span>Verifying…</span></>
                            : <>
                                <span className="flex-shrink-0 mt-0.5">{s.status === 'match' ? '✅' : s.status === 'partial' ? '⚠️' : '❌'}</span>
                                <div>
                                  <div className={`font-semibold mb-0.5 ${s.status === 'match' ? 'text-emerald-400' : s.status === 'partial' ? 'text-amber-400' : 'text-red-400'}`}>
                                    {s.status === 'error' ? s.errorMsg : `${s.domain}${s.trusted ? ' ✓' : ''} — ${s.score}% match`}
                                  </div>
                                  {s.status !== 'error' && (
                                    <div className="text-stone-400 text-[10px] leading-relaxed">
                                      {s.status === 'match' && 'Source topics match your post.'}
                                      {s.status === 'partial' && 'Some topics found. A more specific source is recommended.'}
                                      {s.status === 'mismatch' && "Key topics from your post weren't found in this source."}
                                    </div>
                                  )}
                                  {(s.matchedKws.length > 0 || s.missedKws.length > 0) && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
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

              {!showSrc2 && (
                <button onClick={() => setShowSrc2(true)} className="text-xs text-gold hover:text-gold/80 transition-colors">
                  + Add second source
                </button>
              )}
            </div>
          )}

          {/* Category */}
          <div className="flex gap-1.5 flex-wrap mt-3 items-center">
            <span className="text-[10px] text-white/30 mr-1">Tag:</span>
            {CATS.map(c => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-all
                  ${cat === c
                    ? 'border-gold text-gold bg-gold/10'
                    : 'border-white/12 text-white/40 hover:border-white/30 hover:text-white/70'}`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3.5">
            <span className={`font-mono text-[11px] ${text.length > 420 ? 'text-red-400' : 'text-white/30'}`}>
              {text.length} / 500
            </span>
            <div className="flex items-center gap-2">
              {needsSource && !hasValidSource && (
                <span className="text-[10px] text-red-400">⚠ source required</span>
              )}
              <button
                onClick={handlePost}
                disabled={!canPost}
                className="px-6 py-2 bg-rust text-white rounded-lg font-serif font-bold text-sm hover:bg-rust2 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:-translate-y-px active:translate-y-0"
              >
                {posting ? 'Publishing…' : 'Publish →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
