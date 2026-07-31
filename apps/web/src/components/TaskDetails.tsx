import { ExternalLink, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Task, User } from '../domain/models'
import { StatusBadge } from './StatusBadge'
import { formatDate } from './TaskList'

export function TaskDetails({
  task,
  user,
  actions,
  onClose,
}: {
  task: Task | null
  user?: User
  actions?: ReactNode
  onClose: () => void
}) {
  const openerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!task) return
    openerRef.current = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', listener)
    return () => {
      document.removeEventListener('keydown', listener)
      document.body.style.overflow = previousOverflow
      openerRef.current?.focus()
    }
  }, [task?.id])

  if (!task) return null

  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <header className="drawer-header">
          <div>
            <p className="eyebrow">TASK DETAILS</p>
            <h2 id="task-details-title">任务详情</h2>
          </div>
          <button className="icon-button" aria-label="关闭任务详情" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="drawer-content">
          <div className="details-status"><StatusBadge status={task.status} /><span>{task.id}</span></div>
          <dl className="details-grid">
            <div><dt>任务链接</dt><dd><a href={task.url} target="_blank" rel="noreferrer">{task.url}<ExternalLink size={14} /></a></dd></div>
            <div className="qr-detail-row"><dt>支付二维码</dt><dd><div className="qr-code-frame" role="img" aria-label={`任务 ${task.id} 支付二维码`}><QRCodeSVG value={task.url} size={184} level="M" bgColor="#ffffff" fgColor="#172033" /></div><span className="qr-helper">使用手机扫码打开该支付链接</span></dd></div>
            {user || task.username ? <div><dt>提交用户</dt><dd>{user?.username ?? task.username}</dd></div> : null}
            <div><dt>提交时间</dt><dd>{formatDate(task.submittedAt)}</dd></div>
            <div><dt>开始处理</dt><dd>{formatDate(task.processingStartedAt)}</dd></div>
            <div><dt>完成时间</dt><dd>{formatDate(task.completedAt)}</dd></div>
            {task.feedback ? <div><dt>处理反馈</dt><dd className="feedback-content">{task.feedback}</dd></div> : null}
          </dl>
        </div>
        {actions ? <footer className="drawer-actions">{actions}</footer> : null}
      </aside>
    </div>
  )
}
