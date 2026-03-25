import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listSessions } from '../api'
import type { Session } from '../api'
import { TaskProcessPage } from './TaskProcessPage'

export function TaskDetailPage() {
  const { id } = useParams()
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setNotFound(false)

    listSessions()
      .then((sessions) => {
        if (!active) return
        const matchedSession = sessions.find((item) => item.id === id) ?? null
        setSession(matchedSession)
        setNotFound(!matchedSession)
      })
      .catch((error) => {
        if (!active) return
        console.error('Failed to load task session', error)
        setNotFound(true)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <section className="page-shell">
        <div className="page-card narrow">
          <p className="page-copy">正在加载任务过程...</p>
        </div>
      </section>
    )
  }

  if (notFound || !session) {
    return (
      <section className="page-shell">
        <div className="page-card narrow">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Task</p>
              <h2>任务不存在</h2>
            </div>
          </div>
          <p className="page-copy">
            没有找到对应的任务会话，可能已经被删除，或者链接中的 ID 不正确。
          </p>
          <div className="task-actions">
            <Link className="primary-action link-action" to="/tasks/new">
              创建新任务
            </Link>
            <Link className="secondary-action link-action" to="/sessions">
              返回 Sessions
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="task-layout">
      <aside className="task-summary">
        <p className="eyebrow">Task Process</p>
        <h2>{session.title || '未命名任务'}</h2>
        <dl className="meta-list">
          <div>
            <dt>ID</dt>
            <dd>{session.id}</dd>
          </div>
          <div>
            <dt>创建时间</dt>
            <dd>{new Date(session.time.created).toLocaleString('zh-CN')}</dd>
          </div>
          <div>
            <dt>目录</dt>
            <dd>{session.directory || '-'}</dd>
          </div>
        </dl>

        <div className="task-actions">
          <Link className="primary-action link-action" to="/tasks/new">
            发起新任务
          </Link>
          <Link className="secondary-action link-action" to="/sessions">
            打开 Sessions
          </Link>
        </div>
      </aside>

      <div className="task-chat">
        <TaskProcessPage session={session} />
      </div>
    </section>
  )
}
