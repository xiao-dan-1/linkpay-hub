import { Activity, ExternalLink, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AtCheckResult } from '../api/at'
import { checkAt } from '../api/at'
import type { Task, User } from '../domain/models'
import { extractAccountInfo } from '../domain/jwt-decode'
import { AtResultModal } from './AtResultModal'
import { StatusBadge } from './StatusBadge'
import { TaskCountdown } from './TaskCountdown'
import { formatDate as formatTime } from './TaskList'

type AtModalData = { title: string; result: AtCheckResult }

function dash(v: string | null | undefined): string {
  return v || '—'
}

export function TaskDetails({
  task, user, actions, onClose,
}: { task: Task | null; user?: User; actions?: ReactNode; onClose: () => void }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [toastMsg, setToastMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [atModal, setAtModal] = useState<AtModalData | null>(null)

  useEffect(() => {
    if (!task) return
    document.body.style.overflow = 'hidden'
    const l = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', l)
    return () => { document.removeEventListener('keydown', l); document.body.style.overflow = '' }
  }, [task?.id])

  const handleCheck = async () => {
    if (!task?.at) return
    setLoading(true)
    try { setAtModal({ title: task.id, result: await checkAt(task.at) }) }
    catch (err) { setToastMsg(err instanceof Error ? err.message : 'at 查询失败') }
    finally { setLoading(false) }
  }

  if (!task) return null

  const info = task.at ? extractAccountInfo(task.at) : null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal task-detail-modal" role="dialog" aria-modal="true" aria-label="任务详情">
        {/* header */}
        <header className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={task.status} />
            <span className="task-id">{task.id}</span>
            {task.at ? (
              <button className="button compact secondary" disabled={loading} onClick={() => void handleCheck()}>
                <Activity size={14} className={loading ? 'icon-pulse' : ''} />{loading ? '查询中' : '测活'}
              </button>
            ) : null}
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="modal-body">
          {/* URL + QR side by side */}
          <div className="td-link-row">
            <div className="td-link-info">
              <a href={task.url} target="_blank" rel="noreferrer" className="td-url">{task.url}<ExternalLink size={13} /></a>
            </div>
            <img className="td-qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(task.url)}`} alt="二维码" />
          </div>

          {/* stat cards */}
          <div className="at-stat-grid">
            <div className="at-stat-item"><span className="at-stat-label">提交时间</span><span className="at-stat-value">{formatTime(task.submittedAt)}</span></div>
            <div className="at-stat-item"><span className="at-stat-label">开始处理</span><span className="at-stat-value">{formatTime(task.processingStartedAt)}</span></div>
            <div className="at-stat-item"><span className="at-stat-label">完成时间</span><span className="at-stat-value">{formatTime(task.completedAt)}</span></div>
            <div className="at-stat-item">
              <span className="at-stat-label">处理时限</span>
              <span className="at-stat-value">
                {task.status === 'queued' || task.status === 'processing' ? <TaskCountdown submittedAt={task.submittedAt} /> : '—'}
              </span>
            </div>
          </div>

          {/* account info */}
          {info ? (
            <div className="at-stat-grid" style={{ marginTop: 8 }}>
              <div className="at-stat-item"><span className="at-stat-label">账号</span><span className="at-stat-value" style={{ fontSize: 13, fontFamily: '"SFMono-Regular",Consolas,monospace' }}>{info.email || '—'}</span></div>
              <div className="at-stat-item"><span className="at-stat-label">套餐</span><span className="at-stat-value">{dash(info.planType)}</span></div>
              <div className="at-stat-item"><span className="at-stat-label">Token</span><span className="at-stat-value" style={{ color: info.isExpired ? 'var(--failed)' : undefined }}>{info.isExpired ? '已过期' : '有效'}</span></div>
              {(user || task.userLabel) ? <div className="at-stat-item"><span className="at-stat-label">提交用户</span><span className="at-stat-value">{dash(user?.note || user?.maskedKey || task.userLabel)}</span></div> : null}
            </div>
          ) : (user || task.userLabel) ? (
            <div className="at-stat-grid" style={{ marginTop: 8 }}>
              {(user || task.userLabel) ? <div className="at-stat-item"><span className="at-stat-label">提交用户</span><span className="at-stat-value">{dash(user?.note || user?.maskedKey || task.userLabel)}</span></div> : null}
            </div>
          ) : null}

          {/* feedback */}
          {task.feedback ? <div className="feedback-content" style={{ marginTop: 12 }}>{task.feedback}</div> : null}
        </div>

        {toastMsg ? <div className="toast-region"><div className="toast" role="status">{toastMsg}</div></div> : null}
        <AtResultModal data={atModal} onClose={() => setAtModal(null)} />
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </div>
    </div>
  )
}
