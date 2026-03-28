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
    headers: authHeaders(),
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

  let cancelled = false
  let currentController: AbortController | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const connect = async () => {
    if (cancelled) return
    currentController = new AbortController()

    try {
      const res = await fetch(url, {
        headers: authHeaders(),
        signal: currentController.signal,
      })

      if (!res.ok || !res.body) {
        if (!cancelled) {
          onStatus?.('reconnecting')
          reconnectTimer = setTimeout(connect, 2000)
        }
        return
      }

      onStatus?.('connected')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            // Backend sends { directory, payload: { type, properties } }
            const event = data.payload ?? data
            if (!event?.type) continue
            // Track tool timing based on part status changes
            if (event.type === 'message.part.updated') {
              const part = event.properties?.part
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
            onEvent(event)
          } catch { /* ignore */ }
        }
      }

      if (!cancelled) {
        onStatus?.('reconnecting')
        reconnectTimer = setTimeout(connect, 2000)
      }
    } catch {
      if (!cancelled) {
        onStatus?.('reconnecting')
        reconnectTimer = setTimeout(connect, 2000)
      }
    }
  }

  void connect()

  return () => {
    cancelled = true
    if (reconnectTimer !== null) clearTimeout(reconnectTimer)
    currentController?.abort()
  }
}

// --- Document API ---

export interface DocumentFile {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: number
}

export async function listDocuments(recursive = true) {
  return request<DocumentFile[]>(`/document?recursive=${recursive}`)
}

export async function getDocument(filePath: string) {
  return request<{ path: string; content: string }>(`/document/${filePath}`)
}

export async function updateDocument(filePath: string, content: string) {
  return request<{ success: boolean }>(`/document/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

export async function createDocument(filePath: string, content = '') {
  return request<{ success: boolean; path: string }>('/document', {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content }),
  })
}

export async function deleteDocument(filePath: string) {
  return request<{ success: boolean }>(`/document/${filePath}`, {
    method: 'DELETE',
  })
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

export interface ProviderListResponse {
  all: ProviderInfo[]
  default: Record<string, string>
  connected: string[]
}

export interface SessionEvent {
  type: string
  properties: Record<string, unknown>
}

export async function listAgents() {
  return request<AgentInfo[]>('/agent')
}

export async function listProviders() {
  return request<ProviderListResponse>('/provider')
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

async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SessionEvent) => void,
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const parseBlock = (block: string) => {
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue
      dataLines.push(line.slice(5).trimStart())
    }
    if (dataLines.length === 0) return

    const data = JSON.parse(dataLines.join('\n'))
    const event = data.payload ?? data
    if (!event?.type) return
    onEvent(event as SessionEvent)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      parseBlock(block)
      boundary = buffer.indexOf('\n\n')
    }
  }

  if (buffer.trim()) {
    parseBlock(buffer)
  }
}

export async function sendMessageStreamWithOptions(
  sessionID: string,
  parts: Array<{ type: string; [key: string]: unknown }>,
  options?: { agent?: string; model?: { providerID: string; modelID: string } },
  handlers?: {
    signal?: AbortSignal
    onEvent?: (event: SessionEvent) => void
    onStatus?: (status: 'connected' | 'disconnected') => void
  },
) {
  const res = await fetch(`${API_BASE_URL}/session/${sessionID}/prompt_sse`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ parts, ...options }),
    signal: handlers?.signal,
  })

  if (res.status === 401) {
    clearAuth()
    window.location.reload()
    throw new Error('认证失败，请重新登录')
  }
  if (!res.ok || !res.body) {
    const text = await res.text()
    throw new Error(`API ${res.status}: ${text}`)
  }

  handlers?.onStatus?.('connected')

  try {
    await consumeSSEStream(res.body, (event) => {
      if (event.type === 'message.part.updated') {
        const part = event.properties?.part
        if (part && typeof part === 'object' && !Array.isArray(part)) {
          const toolPart = part as {
            id?: string
            type?: string
            state?: { status?: string }
          }
          if (toolPart.type === 'tool' && typeof toolPart.id === 'string') {
            const status = toolPart.state?.status
            if (status === 'running') {
              toolTimings.set(toolPart.id, { startTime: Date.now() })
            } else if (status === 'completed' || status === 'error') {
              const timing = toolTimings.get(toolPart.id)
              if (timing && !timing.duration) {
                timing.duration = Date.now() - timing.startTime
              }
            }
          }
        }
      }

      handlers?.onEvent?.(event)
    })
  } finally {
    handlers?.onStatus?.('disconnected')
  }
}

// --- Config & Settings ---

export interface AppConfig {
  model?: string
  small_model?: string
  disabled_providers?: string[]
  enabled_providers?: string[]
  [key: string]: unknown
}

export interface AppSettings {
  enabled_skills?: string[]
  enabled_plugins?: string[]
}

export async function getConfig() {
  return request<AppConfig>('/config')
}

export async function updateConfig(patch: Partial<AppConfig>) {
  return request<AppConfig>('/config', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export async function getSettings() {
  return request<AppSettings>('/settings')
}

export async function updateSettings(patch: Partial<AppSettings>) {
  return request<AppSettings>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

// --- Schedule API ---

export interface ScheduleTask {
  id: string
  name: string
  description?: string
  cron: string
  command: string
  enabled: boolean
  last_run?: number | null
  next_run?: number | null
  time_created: number
  time_updated: number
}

export async function listSchedules() {
  return request<ScheduleTask[]>('/schedule')
}

export async function createSchedule(data: { name: string; description?: string; cron: string; command: string; enabled?: boolean }) {
  return request<ScheduleTask>('/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSchedule(id: string, data: Partial<{ name: string; description: string; cron: string; command: string; enabled: boolean }>) {
  return request<ScheduleTask>(`/schedule/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSchedule(id: string) {
  return request<{ success: boolean }>(`/schedule/${id}`, {
    method: 'DELETE',
  })
}

export async function triggerSchedule(id: string) {
  return request<{ success: boolean; triggered_at: number }>(`/schedule/${id}/trigger`, {
    method: 'POST',
  })
}
