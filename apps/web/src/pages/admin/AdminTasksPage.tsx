import { Search } from 'lucide-react'
import { useState } from 'react'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { useData } from '../../data/DataContext'
import type { Task, TaskStatus } from '../../domain/models'

type StatusFilter = 'all' | TaskStatus

export function AdminTasksPage() {
  const { repository } = useData()
  const state = repository.getState()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const normalized = search.trim().toLowerCase()
  const filteredTasks = [...state.tasks]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .filter((task) => {
      const user = state.users.find((item) => item.id === task.userId)
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter
      const matchesSearch =
        !normalized ||
        task.id.toLowerCase().includes(normalized) ||
        task.url.toLowerCase().includes(normalized) ||
        user?.username.toLowerCase().includes(normalized)
      return matchesStatus && matchesSearch
    })
  const selectedUser = selectedTask
    ? state.users.find((user) => user.id === selectedTask.userId)
    : undefined

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">TASK MONITORING</p><h1>全部任务</h1><p>跨用户查看任务状态和完整时间线。</p></div><strong className="result-count">{filteredTasks.length} 条结果</strong></header>
      <section className="panel task-panel admin-panel">
        <div className="panel-heading task-panel-heading"><div><h2>任务记录</h2><p>管理员仅查看状态，不代替工作室处理任务。</p></div><div className="filters"><label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号、链接或用户名" /></label><label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label></div></div>
        <TaskList tasks={filteredTasks} users={state.users} onSelect={setSelectedTask} />
      </section>
      <TaskDetails task={selectedTask} user={selectedUser} onClose={() => setSelectedTask(null)} />
    </>
  )
}
