import { useEffect } from 'react'
import { listSessions, createSession, deleteSession } from '../api'
import type { Session } from '../api'
import type { Dispatch, MouseEvent, SetStateAction } from 'react'
import { toast } from './Toast'

interface Props {
  sessions: Session[]
  setSessions: Dispatch<SetStateAction<Session[]>>
  activeSession: Session | null
  setActiveSession: Dispatch<SetStateAction<Session | null>>
}

export function Sidebar({ sessions, setSessions, activeSession, setActiveSession }: Props) {
  useEffect(() => {
    listSessions()
      .then((list) => {
        setSessions(list)
        setActiveSession((current) => current ?? list[0] ?? null)
      })
      .catch((error) => {
        console.error('Failed to load sessions', error)
      })
  }, [setActiveSession, setSessions])

  async function handleCreate() {
    try {
      const title = `分析任务 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
      const session = await createSession(title)
      setSessions((current) => [session, ...current])
      setActiveSession(session)
    } catch (e) {
      console.error('Failed to create session', e)
      toast('创建会话失败')
    }
  }

  async function handleDelete(e: MouseEvent, sessionID: string) {
    e.stopPropagation()
    if (!confirm('确定删除此会话？')) return
    try {
      await deleteSession(sessionID)
      const nextActiveSession =
        activeSession?.id === sessionID
          ? sessions.find((session) => session.id !== sessionID) ?? null
          : activeSession
      setSessions((current) => current.filter((session) => session.id !== sessionID))
      if (activeSession?.id === sessionID) {
        setActiveSession(nextActiveSession)
      }
    } catch (err) {
      console.error('Failed to delete session', err)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>🤖 Agent Core</h1>
        <button className="btn-new" onClick={handleCreate}>
          + 新建会话
        </button>
      </div>
      <div className="session-list">
        {sessions.length === 0 && (
          <p className="no-sessions">暂无会话，点击上方按钮创建</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`session-item ${activeSession?.id === s.id ? 'active' : ''}`}
            onClick={() => setActiveSession(s)}
          >
            <div className="session-title">{s.title || '未命名会话'}</div>
            <div className="session-meta">
              <span>{new Date(s.time.created).toLocaleString('zh-CN')}</span>
              <button
                className="btn-delete"
                onClick={(e) => handleDelete(e, s.id)}
                title="删除"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
