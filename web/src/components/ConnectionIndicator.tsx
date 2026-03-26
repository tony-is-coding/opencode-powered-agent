import { useState, useEffect } from 'react'

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected'

export function ConnectionIndicator({ status }: { status: ConnectionStatus }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status === 'connected') {
      const timer = setTimeout(() => setVisible(false), 2000)
      return () => clearTimeout(timer)
    }
    setVisible(true)
  }, [status])

  if (!visible) return null

  return (
    <div className={`connection-bar connection-${status}`}>
      {status === 'connected' && 'SSE 已连接'}
      {status === 'reconnecting' && '连接断开，正在重连...'}
      {status === 'disconnected' && 'SSE 连接已断开'}
    </div>
  )
}
