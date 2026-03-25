import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  getMessages,
  sendMessageAsync,
  abortSession,
  subscribeEvents,
} from '../api'
import type { Session, MessageWithParts, Part } from '../api'
import { toast } from './Toast'

interface Props {
  session: Session
}

export function ChatView({ session }: Props) {
  const [messages, setMessages] = useState<MessageWithParts[]>([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing messages
  useEffect(() => {
    getMessages(session.id)
      .then(setMessages)
      .catch(console.error)
  }, [session.id])

  // Subscribe to SSE events for real-time updates
  useEffect(() => {
    const unsub = subscribeEvents(session.id, (event) => {
      if (
        event.type === 'message.updated' ||
        event.type === 'message.part.updated' ||
        event.type === 'message.part.delta'
      ) {
        // Refresh messages on any message update
        getMessages(session.id).then(setMessages).catch(console.error)
      }
      if (event.type === 'session.idle') {
        setStreaming(false)
        setSending(false)
        getMessages(session.id).then(setMessages).catch(console.error)
      }
    })
    return unsub
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

      await sendMessageAsync(session.id, parts)

      setInput('')
      setFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Refresh messages to show user message
      setTimeout(() => {
        getMessages(session.id).then(setMessages).catch(console.error)
      }, 500)
    } catch (e) {
      console.error('Send failed', e)
      toast(`发送失败: ${e instanceof Error ? e.message : e}`)
      setSending(false)
      setStreaming(false)
    }
  }, [input, files, session.id])

  const handleAbort = async () => {
    try {
      await abortSession(session.id)
      setStreaming(false)
      setSending(false)
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
      <div className="chat-header">
        <h2>{session.title || '未命名会话'}</h2>
        <span className="session-id">{session.id}</span>
      </div>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty-chat">
            <p>📎 上传文件并输入分析指令，AI 将为你生成分析报告</p>
            <p className="hint">支持 txt, md, csv, json, xml, yaml, log, 代码文件等</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.info.id} message={msg} />
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

function MessageBubble({ message }: { message: MessageWithParts }) {
  const { info, parts } = message
  const isUser = info.role === 'user'

  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-role">{isUser ? '👤 用户' : '🤖 助手'}</div>
      <div className="message-content">
        {parts.map((part) => (
          <PartView key={part.id} part={part} />
        ))}
        {!isUser && info.tokens && (
          <div className="message-meta">
            tokens: {info.tokens.input}↑ {info.tokens.output}↓
            {info.cost ? ` · $${info.cost.toFixed(4)}` : ''}
          </div>
        )}
      </div>
    </div>
  )
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
    case 'tool':
      return (
        <div className={`part-tool ${part.state?.status || ''}`}>
          <div className="tool-header">
            🔧 {part.tool}
            <span className={`tool-status status-${part.state?.status}`}>
              {part.state?.status === 'completed' ? '✓' :
               part.state?.status === 'error' ? '✗' :
               part.state?.status === 'running' ? '⟳' : '…'}
            </span>
          </div>
          {part.state?.title && <div className="tool-title">{part.state.title}</div>}
          {part.state?.error && <div className="tool-error">{part.state.error}</div>}
          {part.state?.output && part.state.output.length < 2000 && (
            <details className="tool-output">
              <summary>输出</summary>
              <pre>{part.state.output}</pre>
            </details>
          )}
        </div>
      )
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
