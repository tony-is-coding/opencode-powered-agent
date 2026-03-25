import { useEffect, useState, useMemo } from 'react'
import { listSessions, createSession, deleteSession, getMessages } from '../api'
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
  const [search, setSearch] = useState('')

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

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return sessions
    return sessions.filter((s) =>
      (s.title || '').toLowerCase().includes(keyword) ||
      s.id.toLowerCase().includes(keyword),
    )
  }, [search, sessions])

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
      toast('删除会话失败')
    }
  }

  async function handleExport(e: MouseEvent, session: Session) {
    e.stopPropagation()
    try {
      const messages = await getMessages(session.id)
      const lines: string[] = [
        `# ${session.title || '未命名会话'}`,
        '',
        `> Session ID: ${session.id}`,
        `> Created: ${new Date(session.time.created).toLocaleString('zh-CN')}`,
        '',
        '---',
        '',
      ]
      for (const msg of messages) {
        const role = msg.info.role === 'user' ? 'User' : 'Assistant'
        lines.push(`## ${role}`)
        lines.push('')
        for (const part of msg.parts) {
          if (part.type === 'text' && part.text) {
            lines.push(part.text)
          } else if (part.type === 'tool') {
            lines.push(`> Tool: ${part.tool} [${part.state?.status}]`)
            if (part.state?.output) {
              lines.push('```')
              lines.push(part.state.output.slice(0, 2000))
              lines.push('```')
            }
          }
          lines.push('')
        }
        lines.push('---')
        lines.push('')
      }
      const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(session.title || 'session').replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '_')}.md`
      a.click()
      URL.revokeObjectURL(url)
      toast('导出成功', 'success')
    } catch {
      toast('导出失败')
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Agent Core</h1>
        <button className="btn-new" onClick={handleCreate}>
          + 新建会话
        </button>
      </div>
      <div className="sidebar-search">
        <input
          type="search"
          placeholder="搜索会话..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
      </div>
      <div className="session-list">
        {filtered.length === 0 && (
          <p className="no-sessions">
            {search ? '没有匹配的会话' : '暂无会话，点击上方按钮创建'}
          </p>
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`session-item ${activeSession?.id === s.id ? 'active' : ''}`}
            onClick={() => setActiveSession(s)}
          >
            <div className="session-title">{s.title || '未命名会话'}</div>
            <div className="session-meta">
              <span>{new Date(s.time.created).toLocaleString('zh-CN')}</span>
              <div className="session-actions">
                <button
                  className="btn-export"
                  onClick={(e) => handleExport(e, s)}
                  title="导出 Markdown"
                >
                  ↓
                </button>
                <button
                  className="btn-delete"
                  onClick={(e) => handleDelete(e, s.id)}
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
