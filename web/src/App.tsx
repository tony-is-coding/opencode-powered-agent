import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { healthCheck, hasAuth, clearAuth } from './api'
import { ToastContainer } from './components/Toast'
import { LoginPage } from './pages/LoginPage'
import { NewTaskPage } from './pages/NewTaskPage'
import { SessionsPage } from './pages/SessionsPage'
import { SkillsPage } from './pages/SkillsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import { DocumentsPage } from './pages/DocumentsPage'
import './App.css'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'opencode-agent-theme'

const navItems = [
  { to: '/sessions', label: 'Sessions' },
  { to: '/documents', label: 'Documents' },
  { to: '/skills', label: 'Skills' },
  { to: '/tasks/new', label: 'New Task' },
]

function getInitialTheme(): Theme {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  return storedTheme === 'light' ? 'light' : 'dark'
}

function AppLayout({
  theme,
  onToggleTheme,
}: {
  theme: Theme
  onToggleTheme: () => void
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">OC</span>
          <div>
            <h1>OpenCode Agent</h1>
            <p>Router-driven workspace</p>
          </div>
        </div>

        <div className="topbar-actions">
          <nav className="topnav" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `topnav-link${isActive ? ' active' : ''}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <button className="theme-toggle" onClick={onToggleTheme} type="button">
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          {hasAuth() && (
            <button className="btn-logout" onClick={() => { clearAuth(); window.location.reload() }} type="button">
              退出
            </button>
          )}
        </div>
      </header>

      <div className="route-view">
        <Outlet />
      </div>
      <ToastContainer />
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [status, setStatus] = useState<'loading' | 'needsAuth' | 'ready'>('loading')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    healthCheck()
      .then(() => setStatus('ready'))
      .catch((err) => {
        if (err instanceof Error && err.message.includes('401')) {
          setStatus('needsAuth')
        } else if (hasAuth()) {
          // Has stored auth but server might not require it
          setStatus('ready')
        } else {
          setStatus('needsAuth')
        }
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="spinner" />
          <p>正在连接后端服务...</p>
        </div>
      </div>
    )
  }

  if (status === 'needsAuth') {
    return <LoginPage onLogin={() => setStatus('ready')} />
  }

  return (
    <Routes>
      <Route
        element={
          <AppLayout
            theme={theme}
            onToggleTheme={() =>
              setTheme((currentTheme) =>
                currentTheme === 'dark' ? 'light' : 'dark',
              )
            }
          />
        }
      >
        <Route index element={<Navigate replace to="/sessions" />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/tasks/new" element={<NewTaskPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="*" element={<Navigate replace to="/sessions" />} />
      </Route>
    </Routes>
  )
}

export default App
