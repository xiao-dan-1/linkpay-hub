import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listAdminTasks } from '../../api/admin'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import type { Task, TaskStatus } from '../../domain/models'

type StatusFilter = 'all' | TaskStatus

export function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      listAdminTasks({
        ...(statusFilter === 'all' ? {} : { status: statusFilter }),
        ...(search.trim() ? { search: search.trim() } : {}),
      }).then(setTasks).catch((cause) => setError(cause instanceof Error ? cause.message : '任务加载失败'))
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search, statusFilter])

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">TASK MONITORING</p><h1>全部任务</h1><p>跨用户查看任务状态和完整时间线。</p></div><strong className="result-count">{tasks.length} 条结果</strong></header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="panel task-panel admin-panel">
        <div className="panel-heading task-panel-heading"><div><h2>任务记录</h2><p>管理员仅查看状态，不代替工作室处理任务。</p></div><div className="filters"><label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号、链接或用户名" /></label><label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label></div></div>
        <TaskList tasks={tasks} users={[]} onSelect={setSelectedTask} />
      </section>
      <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />
    </>
  )
}
