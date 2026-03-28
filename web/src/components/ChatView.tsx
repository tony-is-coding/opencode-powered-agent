import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getMessages,
  sendMessageStreamWithOptions,
  abortSession,
  subscribeEvents,
  listAgents,
  listProviders,
  toolTimings,
} from '../api'
import type {
  Session,
  MessageWithParts,
  Part,
  AgentInfo,
  ProviderInfo,
  SessionEvent,
} from '../api'
import { toast } from './Toast'
import { ConnectionIndicator } from './ConnectionIndicator'

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

interface Props {
  session: Session
}

export function ChatView({ session }: Props) {
  const [messages, setMessages] = useState<MessageWithParts[]>([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [sseStatus, setSseStatus] = useState<ConnectionStatus>('disconnected')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeStreamRef = useRef(false)
  const streamControllerRef = useRef<AbortController | null>(null)

  // Load existing messages
  useEffect(() => {
    getMessages(session.id)
      .then(setMessages)
      .catch(console.error)
  }, [session.id])

  // Load agents and providers
  useEffect(() => {
    listAgents()
      .then((list) => {
        const visible = list.filter((a) => a.mode !== 'subagent')
        setAgents(visible)
        if (!selectedAgent && visible.length > 0) {
          setSelectedAgent(visible.find((a) => a.name === 'build')?.name ?? visible[0].name)
        }
      })
      .catch(console.error)
    listProviders()
      .then((data) => {
        setProviders(data.all)
        if (!selectedModel) {
          const connectedProvider = data.connected.find((providerID) => data.default[providerID])
          const providerID = connectedProvider ?? Object.keys(data.default)[0]
          const modelID = providerID ? data.default[providerID] : undefined
          if (providerID && modelID) {
            setSelectedModel(`${providerID}/${modelID}`)
          }
        }
      })
      .catch(console.error)
  }, [])

  const syncMessages = useCallback(() => {
    return getMessages(session.id).then(setMessages).catch(console.error)
  }, [session.id])

  const handleSessionEvent = useCallback((event: SessionEvent) => {
    if (!eventBelongsToSession(event.properties, session.id)) return

    if (
      event.type === 'message.updated' ||
      event.type === 'message.part.updated' ||
      event.type === 'message.part.delta' ||
      event.type === 'message.part.removed'
    ) {
      setMessages((current) => applySessionEvent(current, event))
    }

    if (event.type === 'session.status') {
      const status = asRecord(event.properties.status)
      const statusType = typeof status?.type === 'string' ? status.type : ''

      if (statusType === 'busy' || statusType === 'retry') {
        setStreaming(true)
        setSending(true)
      }

      if (statusType === 'idle') {
        setStreaming(false)
        setSending(false)
        void syncMessages()
      }
    }

    if (event.type === 'session.idle' || event.type === 'stream.done') {
      setStreaming(false)
      setSending(false)
      void syncMessages()
    }

    if (event.type === 'session.error' || event.type === 'stream.error') {
      const message = extractEventError(event)
      if (message) {
        toast(`执行失败: ${message}`)
      }
      setStreaming(false)
      setSending(false)
      void syncMessages()
    }
  }, [session.id, syncMessages])

  // Keep global event subscription for passive updates. Active sends use prompt_sse directly.
  useEffect(() => {
    const unsub = subscribeEvents(session.id, (event) => {
      if (activeStreamRef.current) return
      handleSessionEvent(event)
    }, (status) => {
      setSseStatus(status)
      if (status === 'connected') {
        void syncMessages()
      }
    })
    return unsub
  }, [handleSessionEvent, session.id, syncMessages])

  useEffect(() => {
    return () => {
      streamControllerRef.current?.abort()
      activeStreamRef.current = false
    }
  }, [session.id])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  const streamParts = useCallback(async (
    parts: Array<{ type: string; [key: string]: unknown }>,
  ) => {
    const controller = new AbortController()
    streamControllerRef.current?.abort()
    streamControllerRef.current = controller
    activeStreamRef.current = true

    try {
      await sendMessageStreamWithOptions(session.id, parts, {
        agent: selectedAgent || undefined,
        model: selectedModel ? {
          providerID: selectedModel.split('/')[0],
          modelID: selectedModel.split('/').slice(1).join('/'),
        } : undefined,
      }, {
        signal: controller.signal,
        onEvent: handleSessionEvent,
      })
      await syncMessages()
    } catch (error) {
      if (controller.signal.aborted) return
      throw error
    } finally {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null
      }
      activeStreamRef.current = false
      setSending(false)
      setStreaming(false)
    }
  }, [handleSessionEvent, selectedAgent, selectedModel, session.id, syncMessages])

  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed && files.length === 0) return

    setSending(true)
    setStreaming(true)

    try {
      const parts: Array<{ type: string; [key: string]: unknown }> = []

      // Add file parts
      for (const file of files) {
        const isText = file.type.startsWith('text/') ||
          /\.(txt|md|csv|json|xml|yaml|yml|log|ts|tsx|js|jsx|py|java|go|rs|sql|html|css|sh|toml|ini|cfg|conf|env)$/i.test(file.name)

        if (isText) {
          // For text files, read content and send as text part with file info
          const content = await readFileAsText(file)
          parts.push({
            type: 'text',
            text: `[文件: ${file.name}]\n\`\`\`\n${content}\n\`\`\``,
          })
        } else {
          // For binary files, send as data URL in file part
          const dataUrl = await readFileAsDataURL(file)
          parts.push({
            type: 'file',
            mime: file.type || 'application/octet-stream',
            filename: file.name,
            url: dataUrl,
          })
        }
      }

      // Add text prompt
      const prompt = trimmed || '请分析上传的文件内容，生成详细的分析报告。'
      parts.push({ type: 'text', text: prompt })

      setInput('')
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''
      await streamParts(parts)
    } catch (e) {
      console.error('Send failed', e)
      toast(`发送失败: ${e instanceof Error ? e.message : e}`)
      setSending(false)
      setStreaming(false)
    }
  }, [files, input, streamParts])

  const handleAbort = async () => {
    try {
      await abortSession(session.id)
    } catch (e) {
      console.error('Abort failed', e)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-view">
      <ConnectionIndicator status={sseStatus} />
      <div className="chat-header">
        <h2>{session.title || '未命名会话'}</h2>
        <span className="session-id">{session.id}</span>
        <div className="chat-selectors">
          {agents.length > 0 && (
            <select
              className="chat-select"
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              title="Agent 模式"
            >
              {agents.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {providers.length > 0 && (
            <select
              className="chat-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              title="Model"
            >
              {providers.map((p) =>
                Object.values(p.models).map((m) => (
                  <option key={`${p.id}/${m.id}`} value={`${p.id}/${m.id}`}>
                    {m.name || m.id}
                  </option>
                )),
              )}
            </select>
          )}
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>📎 上传文件并输入分析指令，AI 将为你生成分析报告</p>
            <p className="hint">支持 txt, md, csv, json, xml, yaml, log, 代码文件等</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.info.id}
            message={msg}
            onRetry={msg.info.role === 'assistant' ? () => {
              const lastUser = messages.slice(0, idx).reverse().find((m) => m.info.role === 'user')
              if (!lastUser) return
              const textPart = lastUser.parts.find((p) => p.type === 'text')
              if (!textPart?.text) return
              setStreaming(true)
              setSending(true)
              streamParts([{ type: 'text', text: textPart.text }])
                .catch((e) => toast(`重试失败: ${e instanceof Error ? e.message : e}`))
            } : undefined}
          />
        ))}
        {streaming && (
          <div className="message assistant">
            <div className="message-content">
              <div className="typing-indicator">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {files.length > 0 && (
          <div className="file-preview">
            {files.map((f, i) => (
              <span key={i} className="file-tag">
                📄 {f.name}
                <button onClick={() => {
                  setFiles(files.filter((_, j) => j !== i))
                }}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="input-row">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="file-input"
            id="file-upload"
            accept=".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.sql,.html,.css,.sh,.toml,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.svg"
          />
          <label htmlFor="file-upload" className="btn-upload" title="上传文件">
            📎
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入分析指令... (Enter 发送, Shift+Enter 换行)"
            rows={1}
            disabled={sending}
          />
          {streaming ? (
            <button className="btn-abort" onClick={handleAbort}>
              ⏹ 停止
            </button>
          ) : (
            <button
              className="btn-send"
              onClick={handleSend}
              disabled={sending && !streaming}
            >
              发送
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, onRetry }: { message: MessageWithParts; onRetry?: () => void }) {
  const { info, parts } = message
  const isUser = info.role === 'user'
  const hasError = !isUser && parts.some((p) => p.type === 'tool' && p.state?.status === 'error')

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-role">{isUser ? '👤 用户' : '🤖 助手'}</div>
      <div className="message-content">
        {parts.map((part) => (
          <PartView key={part.id} part={part} />
        ))}
        {!isUser && (
          <div className="message-meta">
            {info.tokens && (
              <span className="meta-tokens">
                {info.tokens.input}↑ {info.tokens.output}↓
                {info.cost ? ` · $${info.cost.toFixed(4)}` : ''}
              </span>
            )}
            {hasError && onRetry && (
              <button className="btn-retry" onClick={onRetry}>重试</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function PartView({ part }: { part: Part }) {
  switch (part.type) {
    case 'text':
      return (
        <div className="part-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {part.text || ''}
          </ReactMarkdown>
        </div>
      )
    case 'file':
      return (
        <div className="part-file">
          📄 <strong>{part.filename || '文件'}</strong>
          <span className="file-mime">({part.mime})</span>
        </div>
      )
    case 'tool': {
      const timing = toolTimings.get(part.id)
      const showDuration = timing?.duration && (part.state?.status === 'completed' || part.state?.status === 'error')
      return (
        <div className={`part-tool ${part.state?.status || ''}`}>
          <div className="tool-header">
            🔧 {part.tool}
            {showDuration && (
              <span className="tool-duration">{formatDuration(timing.duration!)}</span>
            )}
            <span className={`tool-status status-${part.state?.status}`}>
              {part.state?.status === 'completed' ? '✓' :
               part.state?.status === 'error' ? '✗' :
               part.state?.status === 'running' ? '⟳' : '…'}
            </span>
          </div>
          {part.state?.title && <div className="tool-title">{part.state.title}</div>}
          {part.state?.error && <div className="tool-error">{part.state.error}</div>}
          {part.state?.output && (
            <details className="tool-output">
              <summary>输出 ({part.state.output.length > 1000 ? `${Math.round(part.state.output.length / 1000)}K chars` : `${part.state.output.length} chars`})</summary>
              <pre>{part.state.output}</pre>
            </details>
          )}
        </div>
      )
    }
    case 'reasoning':
      return (
        <details className="part-reasoning">
          <summary>💭 推理过程</summary>
          <div className="reasoning-text">{part.text}</div>
        </details>
      )
    case 'step-start':
      return <div className="part-step">▶ 开始步骤</div>
    case 'step-finish':
      return <div className="part-step">✓ 步骤完成</div>
    default:
      return null
  }
}

function applySessionEvent(messages: MessageWithParts[], event: SessionEvent): MessageWithParts[] {
  if (event.type === 'message.updated') {
    const info = asRecord(event.properties.info)
    if (!info || typeof info.id !== 'string' || typeof info.sessionID !== 'string') return messages

    const next = [...messages]
    const index = next.findIndex((message) => message.info.id === info.id)
    const message: MessageWithParts = {
      info: {
        ...(index >= 0 ? next[index].info : {}),
        ...(info as unknown as MessageWithParts['info']),
      },
      parts: index >= 0 ? next[index].parts : [],
    }

    if (index >= 0) next[index] = message
    else next.push(message)
    return sortMessages(next)
  }

  if (event.type === 'message.part.updated') {
    const part = asRecord(event.properties.part) as Part | null
    if (!part || typeof part.id !== 'string' || typeof part.messageID !== 'string') return messages

    return sortMessages(messages.map((message) => {
      if (message.info.id !== part.messageID) return message
      const parts = upsertPart(message.parts, part)
      return { ...message, parts }
    }))
  }

  if (event.type === 'message.part.delta') {
    const { messageID, partID, field, delta } = event.properties
    if (
      typeof messageID !== 'string' ||
      typeof partID !== 'string' ||
      typeof field !== 'string' ||
      typeof delta !== 'string'
    ) {
      return messages
    }

    return messages.map((message) => {
      if (message.info.id !== messageID) return message
      return {
        ...message,
        parts: message.parts.map((part) => {
          if (part.id !== partID) return part
          const currentValue = part[field]
          if (typeof currentValue === 'string') {
            return {
              ...part,
              [field]: currentValue + delta,
            }
          }
          if (field === 'text' && currentValue === undefined) {
            return {
              ...part,
              text: delta,
            }
          }
          return part
        }),
      }
    })
  }

  if (event.type === 'message.part.removed') {
    const { messageID, partID } = event.properties
    if (typeof messageID !== 'string' || typeof partID !== 'string') return messages

    return messages.map((message) => {
      if (message.info.id !== messageID) return message
      return {
        ...message,
        parts: message.parts.filter((part) => part.id !== partID),
      }
    })
  }

  return messages
}

function sortMessages(messages: MessageWithParts[]) {
  return [...messages].sort((a, b) => {
    const createdDelta = a.info.time.created - b.info.time.created
    if (createdDelta !== 0) return createdDelta
    return a.info.id.localeCompare(b.info.id)
  })
}

function upsertPart(parts: Part[], nextPart: Part) {
  const next = [...parts]
  const index = next.findIndex((part) => part.id === nextPart.id)
  if (index >= 0) {
    next[index] = {
      ...next[index],
      ...nextPart,
    }
  } else {
    next.push(nextPart)
  }
  return next.sort((a, b) => a.id.localeCompare(b.id))
}

function eventBelongsToSession(properties: Record<string, unknown>, sessionID: string): boolean {
  const direct = properties.sessionID ?? properties.sessionId ?? properties.session_id
  if (typeof direct === 'string') return direct === sessionID

  const info = asRecord(properties.info)
  if (info && typeof info.sessionID === 'string') return info.sessionID === sessionID

  const part = asRecord(properties.part)
  if (part && typeof part.sessionID === 'string') return part.sessionID === sessionID

  return false
}

function extractEventError(event: SessionEvent): string {
  if (event.type === 'stream.error') {
    const message = event.properties.message
    return typeof message === 'string' ? message : '未知错误'
  }

  const error = asRecord(event.properties.error)
  if (!error) return ''

  const data = asRecord(error.data)
  if (typeof data?.message === 'string') return data.message
  if (typeof error.message === 'string') return error.message
  return ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}
