export const API_BASE_URL = '/api'

// Tool timing tracking - stores duration per part ID
export const toolTimings = new Map<string, { startTime: number; duration?: number }>()

let authToken: string | null = localStorage.getItem('opencode-auth-token')

export function setAuth(username: string, password: string) {
  authToken = btoa(`${username}:${password}`)
  localStorage.setItem('opencode-auth-token', authToken)
}

export function clearAuth() {
  authToken = null
  localStorage.removeItem('opencode-auth-token')
}

export function hasAuth() {
  return authToken !== null
}

export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Basic ${authToken}`
  return headers
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
    ...options,
  })
  if (res.status === 401) {
    clearAuth()
    window.location.reload()
    throw new Error('认证失败，请重新登录')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}

// --- Types ---

export interface Session {
  id: string
  title: string
  slug: string
  projectID: string
  directory: string
  time: { created: number; updated: number }
}

export interface Skill {
  id: string
  name: string
  description: string
  tags: string[]
  enabled: boolean
}

export interface MessageWithParts {
  info: {
    id: string
    sessionID: string
    role: 'user' | 'assistant'
    time: { created: number; updated: number }
    agent?: string
    cost?: number
    tokens?: { input: number; output: number }
  }
  parts: Part[]
}

export interface Part {
  id: string
  type: string
  text?: string
  tool?: string
  state?: { status: string; title?: string; output?: string; error?: string }
  mime?: string
  filename?: string
  url?: string
  [key: string]: unknown
}

// --- API calls ---

export async function healthCheck() {
  return request<{ healthy: boolean; version: string }>('/global/health')
}

export async function listSessions() {
  return request<Session[]>('/session')
}

export async function createSession(title?: string) {
  return request<Session>('/session', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function deleteSession(sessionID: string) {
  return request<boolean>(`/session/${sessionID}`, { method: 'DELETE' })
}

export async function getMessages(sessionID: string) {
  return request<MessageWithParts[]>(`/session/${sessionID}/message`)
}

export async function sendMessage(
  sessionID: string,
  parts: Array<{ type: string; [key: string]: unknown }>,
) {
  const res = await fetch(`${API_BASE_URL}/session/${sessionID}/message`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ parts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<MessageWithParts>
}

export async function sendMessageAsync(
  sessionID: string,
  parts: Array<{ type: string; [key: string]: unknown }>,
) {
  const res = await fetch(`${API_BASE_URL}/session/${sessionID}/prompt_async`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parts }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}

export async function abortSession(sessionID: string) {
  return request<boolean>(`/session/${sessionID}/abort`, { method: 'POST' })
}

export function subscribeEvents(
  _sessionID: string,
  onEvent: (event: { type: string; properties: Record<string, unknown> }) => void,
  onStatus?: (status: 'connected' | 'reconnecting' | 'disconnected') => void,
) {
  const url = `${API_BASE_URL}/event?directory=${encodeURIComponent(
    window.__OPENCODE_DIR__ || '',
  )}`
  const es = new EventSource(url)
  es.onopen = () => onStatus?.('connected')
  es.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data)
      // Track tool timing based on part status changes
      if (data.type === 'message.part.updated') {
        const part = data.properties?.part
        if (part?.type === 'tool') {
          const status = part.state?.status
          if (status === 'running') {
            toolTimings.set(part.id, { startTime: Date.now() })
          } else if (status === 'completed' || status === 'error') {
            const timing = toolTimings.get(part.id)
            if (timing && !timing.duration) {
              timing.duration = Date.now() - timing.startTime
            }
          }
        }
      }
      onEvent(data)
    } catch { /* ignore */ }
  }
  es.onerror = () => {
    onStatus?.(es.readyState === EventSource.CONNECTING ? 'reconnecting' : 'disconnected')
  }
  return () => es.close()
}

// Extend window for directory config
declare global {
  interface Window {
    __OPENCODE_DIR__?: string
  }
}

// --- Agent & Provider ---

export interface AgentInfo {
  name: string
  description?: string
  mode: string
}

export interface ProviderModel {
  id: string
  providerID: string
  name: string
}

export interface ProviderInfo {
  id: string
  name: string
  models: Record<string, ProviderModel>
}

export async function listAgents() {
  return request<AgentInfo[]>('/agent')
}

export async function listProviders() {
  return request<{ all: ProviderInfo[] }>('/provider')
}

export async function sendMessageAsyncWithOptions(
  sessionID: string,
  parts: Array<{ type: string; [key: string]: unknown }>,
  options?: { agent?: string; model?: { providerID: string; modelID: string } },
) {
  const res = await fetch(`${API_BASE_URL}/session/${sessionID}/prompt_async`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ parts, ...options }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }
}
