import { ExternalLink, X } from 'lucide-react'
import { useEffect } from 'react'
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
  useEffect(() => {
    if (!task) return
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', listener)
    return () => document.removeEventListener('keydown', listener)
  }, [onClose, task])

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
            {user ? <div><dt>提交用户</dt><dd>{user.username}</dd></div> : null}
            <div><dt>提交时间</dt><dd>{formatDate(task.submittedAt)}</dd></div>
            <div><dt>开始处理</dt><dd>{formatDate(task.processingStartedAt)}</dd></div>
            <div><dt>完成时间</dt><dd>{formatDate(task.completedAt)}</dd></div>
          </dl>
        </div>
        {actions ? <footer className="drawer-actions">{actions}</footer> : null}
      </aside>
    </div>
  )
}
