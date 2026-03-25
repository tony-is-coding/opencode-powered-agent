import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { healthCheck } from './api'
import { ToastContainer } from './components/Toast'
import { NewTaskPage } from './pages/NewTaskPage'
import { SessionsPage } from './pages/SessionsPage'
import { SkillsPage } from './pages/SkillsPage'
import { TaskDetailPage } from './pages/TaskDetailPage'
import './App.css'

type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'opencode-agent-theme'

const navItems = [
  { to: '/sessions', label: 'Sessions' },
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
  const [healthy, setHealthy] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    healthCheck()
      .then(() => setHealthy(true))
      .catch(() => setHealthy(false))
  }, [])

  if (!healthy) {
    return (
      <div className="app-loading">
        <div className="loading-card">
          <div className="spinner" />
          <p>正在连接后端服务 (localhost:4096)...</p>
          <button
            onClick={() => {
              healthCheck().then(() => setHealthy(true)).catch(() => {})
            }}
            type="button"
          >
            重试
          </button>
        </div>
      </div>
    )
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
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/tasks/new" element={<NewTaskPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="*" element={<Navigate replace to="/sessions" />} />
      </Route>
    </Routes>
  )
}

export default App
