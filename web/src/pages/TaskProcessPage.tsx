import { useEffect, useMemo, useRef, useState } from 'react'
import { abortSession, getMessages, subscribeEvents } from '../api'
import type { MessageWithParts, Part, Session } from '../api'

type StepStatus = 'pending' | 'running' | 'completed' | 'error'
type StepKind = 'tool' | 'reasoning' | 'output' | 'event'

interface TaskStep {
  id: string
  name: string
  status: StepStatus
  outputPreview: string
  kind: StepKind
  updatedAt: number
}

interface Props {
  session: Session
}

const PREVIEW_LIMIT = 220
const LIVE_OUTPUT_LIMIT = 4000
const REFRESH_THROTTLE_MS = 250

export function TaskProcessPage({ session }: Props) {
  const [steps, setSteps] = useState<TaskStep[]>([])
  const [loading, setLoading] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [idle, setIdle] = useState(true)
  const [liveOutput, setLiveOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aborting, setAborting] = useState(false)
  const refreshTimerRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadSteps = async () => {
      setSteps([])
      setLoading(true)
      setStreaming(false)
      setIdle(true)
      setLiveOutput('')
      setError(null)
      setAborting(false)

      try {
        const messages = await getMessages(session.id)
        if (cancelled) return
        const nextSteps = buildSteps(messages)
        setSteps(nextSteps)
        setIdle(!nextSteps.some((step) => (
          step.status === 'running' || step.status === 'pending'
        )))
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载任务过程失败')
        setLoading(false)
      }
    }

    const refreshSteps = async (options?: { clearLiveOutput?: boolean }) => {
      try {
        const messages = await getMessages(session.id)
        if (cancelled) return
        const nextSteps = buildSteps(messages)
        setSteps(nextSteps)
        setIdle(!nextSteps.some((step) => (
          step.status === 'running' || step.status === 'pending'
        )))
        setError(null)
        if (options?.clearLiveOutput) {
          setLiveOutput('')
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '刷新任务过程失败')
      }
    }

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) return
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null
        void refreshSteps()
      }, REFRESH_THROTTLE_MS)
    }

    void loadSteps()

    const unsubscribe = subscribeEvents(session.id, (event) => {
      if (!eventBelongsToSession(event.properties, session.id)) return

      if (
        event.type === 'session.message.part.delta' ||
        event.type === 'message.part.delta'
      ) {
        setStreaming(true)
        setIdle(false)
        setLiveOutput((current) =>
          appendPreview(current, extractDeltaPreview(event.properties)),
        )
        scheduleRefresh()
      }

      if (
        event.type === 'session.message.completed' ||
        event.type === 'message.updated' ||
        event.type === 'message.part.updated'
      ) {
        setStreaming(false)
        void refreshSteps()
      }

      if (event.type === 'session.idle') {
        setStreaming(false)
        setIdle(true)
        setAborting(false)
        void refreshSteps({ clearLiveOutput: true })
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = null
      }
    }
  }, [session.id])

  const summary = useMemo(() => {
    const total = steps.length
    const completed = steps.filter((step) => step.status === 'completed').length
    const running = steps.filter((step) => step.status === 'running').length
    const pending = steps.filter((step) => step.status === 'pending').length
    const failed = steps.filter((step) => step.status === 'error').length

    if (total === 0) {
      return {
        total,
        completed,
        running,
        pending,
        failed,
        progress: idle ? 0 : 12,
      }
    }

    const settled = completed + failed
    const progress = idle && settled === total
      ? 100
      : Math.max(8, Math.round((settled / total) * 100))

    return { total, completed, running, pending, failed, progress }
  }, [idle, steps])

  const canAbort = streaming || aborting || steps.some((step) => (
    step.status === 'running' || step.status === 'pending'
  )) || !idle

  const handleAbort = async () => {
    setAborting(true)
    setError(null)

    try {
      await abortSession(session.id)
      setStreaming(false)
      setLiveOutput((current) => appendPreview(current, '已发送中止请求。'))
    } catch (err) {
      setAborting(false)
      setError(err instanceof Error ? err.message : '中止任务失败')
    }
  }

  return (
    <div className="task-process-page">
      <header className="task-process-header">
        <div>
          <p className="task-process-kicker">Task Process</p>
          <h2>{session.title || '未命名任务'}</h2>
          <div className="task-process-meta">
            <span>会话 ID: {session.id}</span>
            <span>目录: {session.directory || '未设置'}</span>
          </div>
        </div>
        <div className="task-process-actions">
          <span className={`task-process-badge ${idle ? 'idle' : 'live'}`}>
            {idle ? '空闲' : '执行中'}
          </span>
          <button
            className="btn-abort"
            onClick={handleAbort}
            disabled={!canAbort || aborting}
          >
            {aborting ? '中止中...' : '中止任务'}
          </button>
        </div>
      </header>

      <section className="task-progress-panel">
        <div className="task-progress-header">
          <div>
            <h3>整体进度</h3>
            <p>
              {summary.completed} 已完成 · {summary.running} 执行中 · {summary.pending} 等待中 · {summary.failed} 失败
            </p>
          </div>
          <strong>{summary.progress}%</strong>
        </div>
        <div className="task-progress-bar">
          <div
            className="task-progress-fill"
            style={{ width: `${summary.progress}%` }}
          />
        </div>
      </section>

      {liveOutput && (
        <section className="task-live-panel">
          <div className="task-section-title">
            <h3>实时输出</h3>
            <span>来自 `session.message.part.delta`</span>
          </div>
          <pre>{liveOutput}</pre>
        </section>
      )}

      <section className="task-steps-panel">
        <div className="task-section-title">
          <h3>执行步骤</h3>
          <span>监听 `/event` 实时刷新</span>
        </div>

        {loading && (
          <div className="task-process-empty">正在加载任务步骤...</div>
        )}

        {!loading && error && (
          <div className="task-process-empty task-process-error">{error}</div>
        )}

        {!loading && !error && steps.length === 0 && (
          <div className="task-process-empty">
            当前会话还没有可展示的步骤，等待新的 SSE 事件或消息写入。
          </div>
        )}

        {!loading && !error && steps.length > 0 && (
          <div className="task-steps-list">
            {steps.map((step, index) => (
              <article key={step.id} className={`task-step-card status-${step.status}`}>
                <div className="task-step-index">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="task-step-body">
                  <div className="task-step-header">
                    <div>
                      <h4>{step.name}</h4>
                      <p>{formatKind(step.kind)} · {formatTimestamp(step.updatedAt)}</p>
                    </div>
                    <span className={`task-step-status status-${step.status}`}>
                      {formatStatus(step.status)}
                    </span>
                  </div>
                  <p className={`task-step-preview ${!step.outputPreview ? 'is-empty' : ''}`}>
                    {step.outputPreview || '暂无输出'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function buildSteps(messages: MessageWithParts[]): TaskStep[] {
  return messages
    .flatMap((message) => {
      if (message.info.role !== 'assistant') return []

      return message.parts
        .map((part, index) => toTaskStep(part, message, index))
        .filter((step): step is TaskStep => step !== null)
    })
    .sort((left, right) => left.updatedAt - right.updatedAt)
}

function toTaskStep(
  part: Part,
  message: MessageWithParts,
  index: number,
): TaskStep | null {
  const updatedAt = message.info.time.updated || message.info.time.created

  if (part.type === 'tool') {
    return {
      id: part.id || `${message.info.id}-tool-${index}`,
      name: part.state?.title || part.tool || `工具步骤 ${index + 1}`,
      status: normalizeStatus(part.state?.status),
      outputPreview: previewText(part.state?.error || part.state?.output || part.text),
      kind: 'tool',
      updatedAt,
    }
  }

  if (part.type === 'reasoning') {
    return {
      id: part.id || `${message.info.id}-reasoning-${index}`,
      name: `推理步骤 ${index + 1}`,
      status: 'completed',
      outputPreview: previewText(part.text),
      kind: 'reasoning',
      updatedAt,
    }
  }

  if (part.type === 'text' && part.text?.trim()) {
    return {
      id: part.id || `${message.info.id}-output-${index}`,
      name: '结果输出',
      status: 'completed',
      outputPreview: previewText(part.text),
      kind: 'output',
      updatedAt,
    }
  }

  if (part.type === 'step-start' || part.type === 'step-finish') {
    return {
      id: part.id || `${message.info.id}-${part.type}-${index}`,
      name: part.type === 'step-start' ? '步骤开始' : '步骤完成',
      status: part.type === 'step-start' ? 'running' : 'completed',
      outputPreview: '',
      kind: 'event',
      updatedAt,
    }
  }

  return null
}

function normalizeStatus(status?: string): StepStatus {
  if (status === 'completed') return 'completed'
  if (status === 'error') return 'error'
  if (status === 'running') return 'running'
  return 'pending'
}

function previewText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, PREVIEW_LIMIT)
}

function appendPreview(current: string, delta: string): string {
  if (!delta) return current
  const next = `${current}${current ? '' : ''}${delta}`
  return next.slice(-LIVE_OUTPUT_LIMIT)
}

function extractDeltaPreview(properties: Record<string, unknown>): string {
  const directValue = properties.delta ?? properties.text
  if (typeof directValue === 'string') return directValue

  const part = asRecord(properties.part)
  if (part) {
    const nestedValue = part.delta ?? part.text ?? part.output
    if (typeof nestedValue === 'string') return nestedValue
  }

  return ''
}

function eventBelongsToSession(
  properties: Record<string, unknown>,
  sessionID: string,
): boolean {
  const direct = properties.sessionID ?? properties.sessionId ?? properties.session_id
  if (typeof direct === 'string') return direct === sessionID

  const session = asRecord(properties.session)
  if (session && typeof session.id === 'string') {
    return session.id === sessionID
  }

  return true
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function formatStatus(status: StepStatus): string {
  if (status === 'completed') return 'completed'
  if (status === 'running') return 'running'
  if (status === 'error') return 'error'
  return 'pending'
}

function formatKind(kind: StepKind): string {
  if (kind === 'tool') return '工具'
  if (kind === 'reasoning') return '推理'
  if (kind === 'event') return '事件'
  return '输出'
}

function formatTimestamp(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
