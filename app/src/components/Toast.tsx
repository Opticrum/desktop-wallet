import { useEffect, useState } from 'react'

type ToastProps = {
  message: string | null
  onDismiss: () => void
  durationMs?: number
}

export function Toast({ message, onDismiss, durationMs = 2200 }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!message) {
      setVisible(false)
      return
    }
    setVisible(true)
    const id = window.setTimeout(() => {
      setVisible(false)
      window.setTimeout(onDismiss, 180)
    }, durationMs)
    return () => window.clearTimeout(id)
  }, [message, durationMs, onDismiss])

  if (!message || !visible) return null

  return <div className="toast">{message}</div>
}