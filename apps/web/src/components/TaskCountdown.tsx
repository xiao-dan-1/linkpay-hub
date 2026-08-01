import { useEffect, useState } from 'react'

export const TASK_TIMEOUT_MINUTES = 15
const TIMEOUT_MS = TASK_TIMEOUT_MINUTES * 60 * 1000
const WARNING_MS = 5 * 60 * 1000

export function TaskCountdown({ submittedAt }: { submittedAt: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remaining = TIMEOUT_MS - (now - new Date(submittedAt).getTime())
  if (remaining <= 0) {
    return (
      <span className="countdown expired" title="从提交起 15 分钟">
        可能过期
      </span>
    )
  }

  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  const warning = remaining <= WARNING_MS
  return (
    <span
      className={`countdown${warning ? ' warning' : ''}`}
      title="从提交起 15 分钟"
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}
