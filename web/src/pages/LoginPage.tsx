import { useState } from 'react'
import { setAuth, healthCheck } from '../api'

interface Props {
  onLogin: () => void
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState('opencode')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setAuth(username, password)
    try {
      await healthCheck()
      onLogin()
    } catch {
      setError('认证失败，请检查用户名和密码')
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <span className="brand-mark">OC</span>
          <h1>OpenCode Agent</h1>
          <p>请输入凭证登录</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
            className="login-input"
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="login-input"
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn" disabled={loading || !password}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
