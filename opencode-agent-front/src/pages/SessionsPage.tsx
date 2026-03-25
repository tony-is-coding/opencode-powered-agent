import { useState } from 'react'
import { Sidebar } from '../components/Sidebar'
import { ChatView } from '../components/ChatView'
import type { Session } from '../api'

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)

  return (
    <div className="app">
      <Sidebar
        sessions={sessions}
        setSessions={setSessions}
        activeSession={activeSession}
        setActiveSession={setActiveSession}
      />

      <main className="main">
        {activeSession ? (
          <ChatView session={activeSession} key={activeSession.id} />
        ) : (
          <div className="empty-state">
            <h2>文件分析助手</h2>
            <p>创建或选择一个会话，上传文件并开始与 Agent 协作。</p>
          </div>
        )}
      </main>
    </div>
  )
}
