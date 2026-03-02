// Server-side source verification
// Fetches the URL, extracts text, computes keyword overlap with post content

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was','one',
  'our','out','use','day','how','did','its','let','say','she','too','who','why',
  'with','that','this','have','from','they','will','been','has','than','when',
  'what','into','your','more','about','also','some','then','much','very','just',
  'like','well','only','over','even','most','made','after','first','down','year',
  'does','each','used','take','such','here','these','were','both','many','their',
  'there','would','could','should','which','where','while','those','other','being',
])

const TRUSTED_DOMAINS = [
  'reuters.com','bbc.co.uk','bbc.com','apnews.com','nos.nl','theguardian.com',
  'nytimes.com','washingtonpost.com','ft.com','economist.com','nature.com',
  'pubmed.ncbi.nlm.nih.gov','science.org','who.int','cdc.gov','europa.eu',
  'rijksoverheid.nl','rivm.nl','knmi.nl','cbs.nl','government.nl','europarl.europa.eu',
  'politico.eu','nieuwsuur.nl','nu.nl','ad.nl','volkskrant.nl',
]

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')           // strip HTML tags
    .replace(/[^a-z0-9\s]/g, ' ')       // keep only alphanum
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w))
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function isTrustedDomain(url: string): boolean {
  const u = url.toLowerCase()
  return TRUSTED_DOMAINS.some(d => u.includes(d))
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Veracast/1.0; source verification bot)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) return ''

    const html = await res.text()

    // Strip scripts, styles, nav, footer — keep main content
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
      .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
      .replace(/<header[\s\S]*?<\/header>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 50000) // cap at 50k chars for performance

    return cleaned
  } catch {
    clearTimeout(timeout)
    return ''
  }
}

export interface VerifyResult {
  status: 'match' | 'partial' | 'mismatch' | 'error'
  score: number
  domain: string
  trusted: boolean
  matchedKeywords: string[]
  missedKeywords: string[]
  error?: string
}

export async function verifySource(postText: string, url: string): Promise<VerifyResult> {
  const domain = getDomain(url)
  const trusted = isTrustedDomain(url)

  if (!url.startsWith('http')) {
    return { status: 'error', score: 0, domain, trusted, matchedKeywords: [], missedKeywords: [], error: 'Invalid URL' }
  }

  const pageText = await fetchPageText(url)

  if (!pageText) {
    return { status: 'error', score: 0, domain, trusted, matchedKeywords: [], missedKeywords: [], error: 'Could not fetch URL' }
  }

  const postKws = [...new Set(extractKeywords(postText))]
  const pageKwSet = new Set(extractKeywords(pageText))

  // Top 15 most meaningful words from the post
  const topPostKws = postKws.slice(0, 15)
  const matched = topPostKws.filter(w => pageKwSet.has(w))
  const missed  = topPostKws.filter(w => !pageKwSet.has(w)).slice(0, 6)

  const rawScore = topPostKws.length > 0
    ? Math.round((matched.length / topPostKws.length) * 100)
    : 0

  // Trusted domains get a +15 score bonus (they're more likely to be legitimate)
  const score = Math.min(100, trusted ? rawScore + 15 : rawScore)

  let status: VerifyResult['status']
  if (score >= 50)      status = 'match'
  else if (score >= 22) status = 'partial'
  else                  status = 'mismatch'

  return {
    status,
    score,
    domain,
    trusted,
    matchedKeywords: matched.slice(0, 6),
    missedKeywords: missed,
  }
}
