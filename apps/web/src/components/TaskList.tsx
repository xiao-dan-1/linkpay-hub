import { ExternalLink, Eye, Inbox } from 'lucide-react'
import { useMemo } from 'react'
import type { Task, User } from '../domain/models'
import { StatusBadge } from './StatusBadge'

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function TaskList({
  tasks,
  users,
  onSelect,
  emptyText = '暂时没有符合条件的任务',
}: {
  tasks: Task[]
  users: User[]
  onSelect: (task: Task) => void
  emptyText?: string
}) {
  const userNames = useMemo(
    () => new Map(users.map((user) => [user.id, user.note || user.maskedKey])),
    [users],
  )
  const showUsers = users.length > 0 || tasks.some((task) => Boolean(task.userLabel))

  if (!tasks.length) {
    return (
      <div className="empty-state">
        <Inbox size={28} />
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="task-table-wrap">
      <table className="task-table">
        <thead>
          <tr>
            <th>任务编号</th>
            <th>链接</th>
            {showUsers ? <th>提交用户</th> : null}
            <th>提交时间</th>
            <th>状态</th>
            <th><span className="sr-only">操作</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td data-label="任务编号"><span className="task-id">{task.id}</span></td>
              <td data-label="链接">
                <a className="task-link" href={task.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                  <span>{task.url}</span><ExternalLink size={14} aria-hidden="true" />
                </a>
              </td>
              {showUsers ? <td data-label="提交用户">{task.userLabel ?? (task.userId ? userNames.get(task.userId) : undefined) ?? '未知用户'}</td> : null}
              <td data-label="提交时间">{formatDate(task.submittedAt)}</td>
              <td data-label="状态"><StatusBadge status={task.status} /></td>
              <td className="task-action-cell">
                <button className="icon-button" aria-label={`查看任务 ${task.id}`} onClick={() => onSelect(task)}>
                  <Eye size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { formatDate }
