import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastCtx = createContext(null)

function CheckCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  )
}

function XCircle() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  )
}

function ToastItem({ msg, type, onDone }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10)
    const hide = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 320)
    }, 3200)
    return () => { clearTimeout(show); clearTimeout(hide) }
  }, [onDone])

  const color = type === 'error' ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : type === 'info'  ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
              : 'border-stadium-green/40 bg-stadium-green/10 text-stadium-green'

  const Icon = type === 'error' ? XCircle : type === 'info' ? InfoIcon : CheckCircle

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 border font-mono text-xs uppercase tracking-widest pointer-events-auto shadow-lg transition-all duration-300 ${color}`}
      style={{
        borderRadius: 2,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        minWidth: 240,
        maxWidth: 360,
      }}
    >
      <Icon />
      <span className="leading-snug">{msg}</span>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  function remove(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} msg={t.msg} type={t.type} onDone={() => remove(t.id)} />
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
