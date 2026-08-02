import QRCode from 'qrcode'
import { Activity, ExternalLink, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

export function TaskDetails({
  task, user, actions, onClose,
}: { task: Task | null; user?: User; actions?: ReactNode; onClose: () => void }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [toastMsg, setToastMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [atModal, setAtModal] = useState<AtModalData | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrError, setQrError] = useState(false)

  useEffect(() => {
    if (!task) return
    document.body.style.overflow = 'hidden'
    const l = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', l)
    return () => { document.removeEventListener('keydown', l); document.body.style.overflow = '' }
  }, [task?.id])

  const generateQr = useCallback(async (url: string) => {
    setQrError(false)
    setQrDataUrl(null)
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 280, margin: 1 })
      setQrDataUrl(dataUrl)
    } catch {
      setQrError(true)
    }
  }, [])

  useEffect(() => {
    if (task?.url) { void generateQr(task.url) }
  }, [task?.url, generateQr])

  const handleCheck = async () => {
    if (!task?.at) return
    setLoading(true)
    try { setAtModal({ title: task.id, result: await checkAt(task.at) }) }
    catch (err) { setToastMsg(err instanceof Error ? err.message : 'at 查询失败') }
    finally { setLoading(false) }
  }

  if (!task) return null

  const info = task.at ? extractAccountInfo(task.at) : null
  const hasUser = !!(user || task.userLabel)

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal task-detail-modal" role="dialog" aria-modal="true" aria-label="任务详情">

        <header className="modal-header" style={{ padding: '16px 20px' }}>
          <div className="td-header-left">
            <span className="task-id" style={{ fontSize: 13 }}>{task.id}</span>
            <StatusBadge status={task.status} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {task.at ? (
              <button className="button compact secondary" disabled={loading} onClick={() => void handleCheck()}>
                <Activity size={14} className={loading ? 'icon-pulse' : ''} />测活/查套餐
              </button>
            ) : null}
            <button className="icon-button" aria-label="关闭" onClick={onClose}><X size={18} /></button>
          </div>
        </header>

        <div className="modal-body" style={{ padding: '0 20px 20px' }}>

          {/* QR + Link card */}
          <div className="td-card">
            <div className="td-card-body">
              <a href={task.url} target="_blank" rel="noreferrer" className="td-card-url">{task.url}<ExternalLink size={13} /></a>
            </div>
            {qrError ? (
              <div className="td-card-qr td-card-qr-fallback">二维码生成失败</div>
            ) : qrDataUrl ? (
              <img className="td-card-qr" src={qrDataUrl} alt="二维码" />
            ) : (
              <div className="td-card-qr td-card-qr-loading" />
            )}
          </div>

          {/* info rows */}
          <div className="td-info-rows">
            <div className="td-info-row">
              <span className="td-info-label">提交时间</span>
              <span className="td-info-value">{formatTime(task.submittedAt)}</span>
            </div>
            <div className="td-info-row">
              <span className="td-info-label">处理时限</span>
              <span className="td-info-value">
                {task.status === 'queued' || task.status === 'processing'
                  ? <TaskCountdown submittedAt={task.submittedAt} />
                  : <span className="muted">—</span>}
              </span>
            </div>
            <div className="td-info-row">
              <span className="td-info-label">开始处理</span>
              <span className="td-info-value">{formatTime(task.processingStartedAt)}</span>
            </div>
            <div className="td-info-row">
              <span className="td-info-label">完成时间</span>
              <span className="td-info-value">{formatTime(task.completedAt)}</span>
            </div>
            {hasUser ? (
              <div className="td-info-row">
                <span className="td-info-label">提交用户</span>
                <span className="td-info-value">{(user?.note || user?.maskedKey) ?? task.userLabel}</span>
              </div>
            ) : null}
            {info?.email ? (
              <div className="td-info-row">
                <span className="td-info-label">账号</span>
                <span className="td-info-value td-email">{info.email}</span>
              </div>
            ) : null}
            {info?.planType ? (
              <div className="td-info-row">
                <span className="td-info-label">套餐</span>
                <span className="td-info-value">{info.planType}{info.isExpired ? <span style={{ color: 'var(--failed)', marginLeft: 8, fontSize: 12 }}>已过期</span> : null}</span>
              </div>
            ) : null}
          </div>

          {/* feedback */}
          {task.feedback ? (
            <div className="td-feedback">{task.feedback}</div>
          ) : null}
        </div>

        {toastMsg ? <div className="toast-region"><div className="toast" role="status">{toastMsg}</div></div> : null}
        <AtResultModal data={atModal} onClose={() => setAtModal(null)} />
        {actions ? <footer className="modal-actions" style={{ padding: '12px 20px' }}>{actions}</footer> : null}
      </div>
    </div>
  )
}
