import type { TaskStatus } from '../domain/models'

const labels: Record<TaskStatus, string> = {
  queued: '排队中',
  processing: '处理中',
  success: '成功',
  failed: '失败',
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span
      className={`status-badge status-${status}`}
      data-status={status}
    >
      <span className="status-dot" aria-hidden="true" />
      {labels[status]}
    </span>
  )
}
