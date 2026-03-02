// Centralised fetch wrapper — attaches auth token automatically

let _token: string | null = null

export function setApiToken(t: string | null) {
  _token = t
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = _token || (typeof window !== 'undefined' ? localStorage.getItem('vc_token') : null)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })
  const json = await res.json()
  return { ok: res.ok, status: res.status, data: json.data, error: json.error }
}

export const api = {
  get:    (path: string)              => apiFetch(path),
  post:   (path: string, body: unknown) => apiFetch(path, { method: 'POST',   body: JSON.stringify(body) }),
  delete: (path: string, body?: unknown) => apiFetch(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
}
