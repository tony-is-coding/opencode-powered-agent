import { useState, useEffect, useCallback } from 'react'

export type ToastType = 'error' | 'success' | 'info'

interface Toast {
  id: number
  message: string
  type: ToastType
}

let nextId = 0
let globalAdd: ((message: string, type?: ToastType) => void) | null = null

export function toast(message: string, type: ToastType = 'error') {
  globalAdd?.(message, type)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++nextId
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  useEffect(() => {
    globalAdd = add
    return () => { globalAdd = null }
  }, [add])

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="toast-close"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
