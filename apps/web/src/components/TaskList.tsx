import { Activity, Clock, Copy, Inbox, Pen, ScanLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { AtCheckResult } from '../api/at'
import { checkAt } from '../api/at'
import type { Task, User } from '../domain/models'
import { extractAccountInfo } from '../domain/jwt-decode'
import { AtResultModal } from './AtResultModal'
import { StatusBadge } from './StatusBadge'
import { TaskCountdown } from './TaskCountdown'

function formatTime(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function copyToClipboard(text: string, label: string, setMsg: (m: string) => void) {
  navigator.clipboard.writeText(text).then(
    () => setMsg(`${label}已复制`),
    () => setMsg('复制失败'),
  )
}

type AtModalData = { title: string; result: AtCheckResult }

export function TaskList({
  tasks, users, onSelect, onEdit,
  emptyText = '暂时没有符合条件的任务',
}: {
  tasks: Task[]
  users: User[]
  onSelect: (task: Task) => void
  onEdit?: (task: Task) => void
  emptyText?: string
}) {
  const userNames = useMemo(
    () => new Map(users.map((u) => [u.id, u.note || u.maskedKey])),
    [users],
  )
  const showUsers = users.length > 0 || tasks.some(t => Boolean(t.userLabel))
  const [toastMsg, setToastMsg] = useState('')
  const [loadingTask, setLoadingTask] = useState<string | null>(null)
  const [atModal, setAtModal] = useState<AtModalData | null>(null)

  const handleCheck = async (task: Task) => {
    if (!task.at) return
    setLoadingTask(task.id)
    try {
      setAtModal({ title: task.id, result: await checkAt(task.at) })
    } catch (err) {
      setToastMsg(err instanceof Error ? err.message : 'at 查询失败')
    } finally {
      setLoadingTask(null)
    }
  }

  if (!tasks.length) {
    return (
      <div className="empty-state">
        <Inbox size={28} />
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <>
      {toastMsg ? <div className="toast-region"><div className="toast" role="status">{toastMsg}</div></div> : null}
      <AtResultModal data={atModal} onClose={() => setAtModal(null)} />
      <div className="queue-list">
        {tasks.map((task, i) => {
          const info = task.at ? extractAccountInfo(task.at) : null
          const isExpired = task.status === 'queued' && new Date(task.submittedAt).getTime() + 15 * 60 * 1000 < Date.now()
          return (
            <div key={task.id} className="queue-row">
              {/* seq */}
              <span className="queue-seq">{String(i + 1).padStart(2, '0')}</span>

              {/* status */}
              <StatusBadge status={isExpired && task.status === 'queued' ? 'failed' : task.status} />

              {/* account info */}
              <div className="queue-account">
                {info?.email ? <span className="queue-email" title={info.email}>{info.email}</span> : null}
                {info?.planType ? <span className={`queue-plan${info.planType === 'free' ? ' queue-plan-free' : ''}`}>{info.planType}</span> : null}
                {showUsers ? <span className="queue-user">{task.userLabel ?? (task.userId ? userNames.get(task.userId) : undefined) ?? ''}</span> : null}
              </div>

              {/* link */}
              <span className="queue-link" title={task.url} onClick={() => onSelect(task)}>
                {task.url.length > 48 ? `${task.url.slice(0, 48)}…` : task.url}
              </span>

              {/* time */}
              <div className="queue-time">
                <span title={task.submittedAt}>{formatTime(task.submittedAt)}</span>
                {task.status === 'queued' || task.status === 'processing' ? (
                  <TaskCountdown submittedAt={task.submittedAt} />
                ) : null}
                {isExpired && task.status === 'queued' ? (
                  <span className="queue-expired"><Clock size={12} />超时</span>
                ) : null}
              </div>

              {/* actions */}
              <div className="queue-actions">
                {onEdit && task.status === 'queued' ? (
                  <button className="icon-button" aria-label="编辑" title="编辑" onClick={() => onEdit(task)}>
                    <Pen size={16} />
                  </button>
                ) : null}
                <button className="icon-button" aria-label="扫码" title="扫码处理" onClick={() => onSelect(task)}>
                  <ScanLine size={16} />
                </button>
                {task.at ? (
                  <button className="icon-button" aria-label="复制 at" title="复制 at" onClick={() => copyToClipboard(task.at!, 'AT', setToastMsg)}>
                    <Copy size={16} />
                  </button>
                ) : null}
                {task.at ? (
                  <button className={`icon-button${loadingTask === task.id ? ' checking' : ''}`} aria-label="测活查套餐" title="测活/查套餐" disabled={loadingTask === task.id} onClick={() => void handleCheck(task)}>
                    <Activity size={16} className={loadingTask === task.id ? 'icon-pulse' : ''} />
                  </button>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export { formatTime as formatDate }
