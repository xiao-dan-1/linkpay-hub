import {
  CheckCircle2,
  Clock3,
  Link2,
  LoaderCircle,
  Search,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { ToastRegion } from '../../components/ToastRegion'
import { useData } from '../../data/DataContext'
import type { Task, TaskStatus } from '../../domain/models'
import { InvalidStudioPage } from '../InvalidStudioPage'

type StatusFilter = 'all' | TaskStatus

function isToday(value?: string) {
  if (!value) return false
  return new Date(value).toDateString() === new Date().toDateString()
}

export function StudioPage() {
  const { accessToken } = useParams()
  const { repository, refresh } = useData()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [pendingResult, setPendingResult] = useState<'success' | 'failed' | null>(null)
  const [feedback, setFeedback] = useState('')
  const studio = accessToken
    ? repository.getStudioByAccessToken(accessToken)
    : undefined

  if (!studio) return <InvalidStudioPage />

  const state = repository.getState()
  const tasks = repository.getStudioTasks(studio.id)
  const normalized = search.trim().toLowerCase()
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const user = state.users.find((item) => item.id === task.userId)
    const matchesSearch =
      !normalized ||
      task.url.toLowerCase().includes(normalized) ||
      task.id.toLowerCase().includes(normalized) ||
      user?.username.toLowerCase().includes(normalized)
    return matchesStatus && matchesSearch
  })
  const selectedUser = selectedTask
    ? state.users.find((user) => user.id === selectedTask.userId)
    : undefined

  const counts = {
    queued: tasks.filter((task) => task.status === 'queued').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
    success: tasks.filter((task) => task.status === 'success' && isToday(task.completedAt)).length,
    failed: tasks.filter((task) => task.status === 'failed' && isToday(task.completedAt)).length,
  }

  const openTask = (task: Task) => {
    const opened = repository.openTask(task.id, studio.id)
    refresh()
    setSelectedTask(opened)
    if (task.status === 'queued') setFeedback(`${task.id} 已开始处理`)
  }

  const completeTask = () => {
    if (!selectedTask || !pendingResult) return
    const updated = repository.completeTask(
      selectedTask.id,
      studio.id,
      pendingResult,
    )
    refresh()
    setSelectedTask(updated)
    setFeedback(pendingResult === 'success' ? '任务已处理成功' : '任务已处理失败')
    setPendingResult(null)
  }

  return (
    <>
      <AppShell
        title={studio.name}
        subtitle="打开排队任务时将自动进入处理中状态"
        eyebrow="STUDIO WORKBENCH"
        actions={<div className="queue-indicator"><span>当前排队</span><strong>{counts.queued}</strong></div>}
      >
        <section className="stats-grid studio-stats">
          <StatCard label="排队中" value={counts.queued} tone="queued" icon={<Clock3 size={19} />} />
          <StatCard label="处理中" value={counts.processing} tone="processing" icon={<LoaderCircle size={19} />} />
          <StatCard label="今日成功" value={counts.success} tone="success" icon={<CheckCircle2 size={19} />} />
          <StatCard label="今日失败" value={counts.failed} tone="failed" icon={<XCircle size={19} />} />
        </section>
        <section className="panel task-panel studio-task-panel">
          <div className="panel-heading task-panel-heading">
            <div><p className="eyebrow">PROCESSING QUEUE</p><h2>任务队列</h2><p>按提交时间升序排列，优先处理最早进入队列的任务。</p></div>
            <div className="filters">
              <label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号、链接或用户" /></label>
              <label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label>
            </div>
          </div>
          <div className="queue-note"><Link2 size={16} /><span>当前入口仅展示此工作室的任务，队列不会跨工作室流转。</span></div>
          <TaskList tasks={filteredTasks} users={state.users} onSelect={openTask} />
        </section>
      </AppShell>
      <TaskDetails
        task={selectedTask}
        user={selectedUser}
        onClose={() => setSelectedTask(null)}
        actions={selectedTask?.status === 'processing' ? <><button className="button danger" onClick={() => setPendingResult('failed')}><XCircle size={17} />处理失败</button><button className="button" onClick={() => setPendingResult('success')}><CheckCircle2 size={17} />处理成功</button></> : undefined}
      />
      <ConfirmDialog
        open={pendingResult !== null}
        title={pendingResult === 'success' ? '确认处理成功' : '确认处理失败'}
        description="完成后任务将进入不可逆的终态，请确认处理结果。"
        confirmLabel={pendingResult === 'success' ? '确认成功' : '确认失败'}
        tone={pendingResult === 'success' ? 'primary' : 'danger'}
        onConfirm={completeTask}
        onCancel={() => setPendingResult(null)}
      />
      <ToastRegion message={feedback} />
    </>
  )
}
