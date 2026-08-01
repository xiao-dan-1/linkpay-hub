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

type AtModalData = {
  title: string
  result: AtCheckResult
}

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
  const [toastMsg, setToastMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [atModal, setAtModal] = useState<AtModalData | null>(null)

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

  const handleCheck = async () => {
    if (!task?.at) return
    setLoading(true)
    try {
      const result = await checkAt(task.at)
      setAtModal({ title: task.id, result })
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : 'at 查询失败')
    } finally {
      setLoading(false)
    }
  }

  if (!task) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="modal task-detail-modal" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
        <header className="modal-header">
          <div>
            <p className="eyebrow">TASK DETAILS</p>
            <h2 id="task-details-title">任务详情</h2>
          </div>
          <button className="icon-button" aria-label="关闭任务详情" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="modal-body">
          <div className="details-status"><StatusBadge status={task.status} /><span>{task.id}</span></div>
          <dl className="details-grid">
            <div><dt>任务链接</dt><dd><a href={task.url} target="_blank" rel="noreferrer">{task.url}<ExternalLink size={14} /></a></dd></div>
            <div className="qr-code-wrap">
              <img className="qr-code-img" src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(task.url)}`} alt="支付链接二维码" />
            </div>
            {task.at ? (() => {
              const info = extractAccountInfo(task.at)
              return (
                <>
                  <div><dt>账号</dt><dd className="task-card-email">{info.email || '(无法解析邮箱)'}</dd></div>
                  {info.planType ? <div><dt>JWT 套餐</dt><dd>{info.planType}</dd></div> : null}
                  {info.isExpired ? <div><dt>Token 状态</dt><dd style={{ color: 'var(--failed)' }}>已过期</dd></div> : null}
                </>
              )
            })() : null}
            {user || task.userLabel ? <div><dt>提交用户</dt><dd>{(user ? user.note || user.maskedKey : undefined) ?? task.userLabel}</dd></div> : null}
            <div><dt>提交时间</dt><dd>{formatTime(task.submittedAt)}</dd></div>
            {task.status === 'queued' || task.status === 'processing' ? <div><dt>处理时限倒计时</dt><dd><TaskCountdown submittedAt={task.submittedAt} /></dd></div> : null}
            <div><dt>开始处理</dt><dd>{formatTime(task.processingStartedAt)}</dd></div>
            <div><dt>完成时间</dt><dd>{formatTime(task.completedAt)}</dd></div>
            {task.feedback ? <div><dt>处理反馈</dt><dd className="feedback-content">{task.feedback}</dd></div> : null}
          </dl>
          {task.at ? (
            <div className="drawer-at-actions">
              <button
                className="button compact secondary"
                disabled={loading}
                onClick={() => void handleCheck()}
              >
                <Activity size={15} className={loading ? 'icon-pulse' : ''} />{loading ? '查询中…' : '测活 / 查订阅'}
              </button>
            </div>
          ) : null}
        </div>
        {toastMsg ? (
          <div className="toast-region">
            <div className="toast" role="status">{toastMsg}</div>
          </div>
        ) : null}
        <AtResultModal data={atModal} onClose={() => setAtModal(null)} />
        {actions ? <footer className="modal-actions">{actions}</footer> : null}
      </div>
    </div>
  )
}
