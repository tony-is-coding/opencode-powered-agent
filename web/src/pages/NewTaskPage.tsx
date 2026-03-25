import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession, sendMessageAsync } from '../api'

function createDefaultTitle() {
  return `任务 ${new Date().toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function NewTaskPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState(createDefaultTitle())
  const [prompt, setPrompt] = useState(
    '请分析上传的数据并生成清晰的执行过程与总结。',
  )
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCreating(true)
    setError('')

    try {
      const session = await createSession(title.trim() || createDefaultTitle())
      const trimmedPrompt = prompt.trim()

      if (trimmedPrompt) {
        await sendMessageAsync(session.id, [{ type: 'text', text: trimmedPrompt }])
      }

      navigate(`/tasks/${session.id}`)
    } catch (submitError) {
      console.error('Failed to create task', submitError)
      setError(
        submitError instanceof Error ? submitError.message : '创建任务失败',
      )
      setCreating(false)
    }
  }

  return (
    <section className="page-shell">
      <div className="page-card narrow">
        <div className="page-heading">
          <div>
            <p className="eyebrow">New Task</p>
            <h2>发起新任务</h2>
          </div>
          <span className="status-pill">Session-backed</span>
        </div>

        <p className="page-copy">
          创建任务时会新建会话，并在填写了初始指令后立即触发异步执行。
        </p>

        <form className="task-form" onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="task-title">
            任务标题
          </label>
          <input
            id="task-title"
            className="text-field"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：分析本周日志并生成总结"
          />

          <label className="field-label" htmlFor="task-prompt">
            初始指令
          </label>
          <textarea
            id="task-prompt"
            className="textarea-field"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="描述要执行的任务目标、上下文或限制条件"
            rows={6}
          />

          {error ? <p className="form-error">{error}</p> : null}

          <div className="task-actions">
            <button className="primary-action" type="submit" disabled={creating}>
              {creating ? '创建中...' : '创建任务'}
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
