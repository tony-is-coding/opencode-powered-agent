import { useEffect, useState, useCallback } from 'react'
import {
  type ScheduleTask,
  listSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  triggerSchedule,
} from '../api'
import { toast } from '../components/Toast'

function formatTime(ts?: number | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('zh-CN')
}

function CreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { name: string; description: string; cron: string; command: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cron, setCron] = useState('*/5 * * * *')
  const [command, setCommand] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !command.trim()) return
    onCreate({ name: name.trim(), description, cron, command: command.trim() })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>新建定时任务</h2>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>
        <form className="modal-body" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="field-label">任务名称</label>
          <input className="text-field" placeholder="每日报告" value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <label className="field-label">描述</label>
          <input className="text-field" placeholder="可选描述" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label className="field-label">Cron 表达式</label>
          <input className="text-field" placeholder="*/5 * * * *" value={cron} onChange={(e) => setCron(e.target.value)} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            格式: 分 时 日 月 周 (例: */5 * * * * = 每5分钟)
          </span>

          <label className="field-label">执行命令</label>
          <textarea
            className="textarea-field"
            placeholder="要执行的命令或 prompt"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            style={{ minHeight: 80 }}
          />

          <div className="task-actions" style={{ marginTop: 8 }}>
            <button type="submit" className="primary-action" disabled={!name.trim() || !command.trim()}>创建</button>
            <button type="button" className="secondary-action" onClick={onClose}>取消</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ScheduleCard({
  task,
  onToggle,
  onTrigger,
  onDelete,
}: {
  task: ScheduleTask
  onToggle: (id: string, enabled: boolean) => void
  onTrigger: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="schedule-card">
      <div className="schedule-card__header">
        <div>
          <h3>{task.name}</h3>
          {task.description && <p className="schedule-card__desc">{task.description}</p>}
        </div>
        <label className="skills-switch" aria-label={`切换 ${task.name}`}>
          <input type="checkbox" checked={task.enabled} onChange={() => onToggle(task.id, !task.enabled)} />
          <span className="skills-switch__track" />
        </label>
      </div>

      <div className="schedule-card__meta">
        <div className="schedule-meta-row">
          <span className="schedule-meta-label">Cron</span>
          <code className="schedule-meta-value">{task.cron}</code>
        </div>
        <div className="schedule-meta-row">
          <span className="schedule-meta-label">命令</span>
          <span className="schedule-meta-value schedule-meta-command">{task.command}</span>
        </div>
        <div className="schedule-meta-row">
          <span className="schedule-meta-label">上次执行</span>
          <span className="schedule-meta-value">{formatTime(task.last_run)}</span>
        </div>
        <div className="schedule-meta-row">
          <span className="schedule-meta-label">下次执行</span>
          <span className="schedule-meta-value">{formatTime(task.next_run)}</span>
        </div>
      </div>

      <div className="schedule-card__actions">
        <button className="secondary-action" style={{ padding: '6px 14px', fontSize: '0.82rem' }} onClick={() => onTrigger(task.id)}>
          手动触发
        </button>
        <button
          className="secondary-action"
          style={{ padding: '6px 14px', fontSize: '0.82rem', color: 'var(--danger)' }}
          onClick={() => onDelete(task.id)}
        >
          删除
        </button>
      </div>
    </div>
  )
}

export function SchedulePage() {
  const [tasks, setTasks] = useState<ScheduleTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true)
      const data = await listSchedules()
      setTasks(data)
    } catch {
      toast('加载任务列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreate = useCallback(
    async (data: { name: string; description: string; cron: string; command: string }) => {
      try {
        await createSchedule(data)
        setShowCreate(false)
        await loadTasks()
        toast('任务已创建', 'success')
      } catch (err) {
        toast(err instanceof Error ? err.message : '创建失败')
      }
    },
    [loadTasks],
  )

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await updateSchedule(id, { enabled })
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, enabled } : t)))
        toast(enabled ? '已启用' : '已禁用', 'success')
      } catch {
        toast('更新失败')
      }
    },
    [],
  )

  const handleTrigger = useCallback(
    async (id: string) => {
      try {
        await triggerSchedule(id)
        await loadTasks()
        toast('已触发', 'success')
      } catch {
        toast('触发失败')
      }
    },
    [loadTasks],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('确定删除此任务？')) return
      try {
        await deleteSchedule(id)
        setTasks((prev) => prev.filter((t) => t.id !== id))
        toast('已删除', 'success')
      } catch {
        toast('删除失败')
      }
    },
    [],
  )

  return (
    <section className="schedule-page">
      <header className="schedule-page__header">
        <div>
          <p className="skills-page__eyebrow">Automation</p>
          <h1>Schedules</h1>
          <p className="settings-page__subtitle">管理定时任务和自动化调度</p>
        </div>
        <div className="docs-page__actions">
          <button type="button" className="secondary-action" onClick={loadTasks}>刷新</button>
          <button type="button" className="primary-action" onClick={() => setShowCreate(true)}>新建任务</button>
        </div>
      </header>

      {loading ? (
        <div className="settings-loading">
          <div className="spinner" />
          <p>正在加载任务...</p>
        </div>
      ) : tasks.length === 0 ? (
        <div className="schedule-empty">
          <p>暂无定时任务</p>
          <span>点击「新建任务」创建自动化调度</span>
        </div>
      ) : (
        <div className="schedule-grid">
          {tasks.map((task) => (
            <ScheduleCard
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onTrigger={handleTrigger}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateDialog onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}
    </section>
  )
}

export default SchedulePage
