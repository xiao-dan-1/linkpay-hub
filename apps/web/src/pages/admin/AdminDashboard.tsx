import {
  CheckCircle2,
  Clock3,
  ClipboardList,
  LoaderCircle,
  Users,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { useData } from '../../data/DataContext'
import type { Task } from '../../domain/models'

export function AdminDashboard() {
  const { repository } = useData()
  const state = repository.getState()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const recentTasks = [...state.tasks]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 10)
  const selectedUser = selectedTask
    ? state.users.find((user) => user.id === selectedTask.userId)
    : undefined

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">ADMIN OVERVIEW</p><h1>数据概览</h1><p>查看用户规模与任务状态分布。</p></div><span className="identity-chip">单工作室原型</span></header>
      <section className="stats-grid admin-stats">
        <StatCard label="用户总数" value={state.users.length} icon={<Users size={19} />} />
        <StatCard label="任务总数" value={state.tasks.length} icon={<ClipboardList size={19} />} />
        <StatCard label="排队中" value={state.tasks.filter((task) => task.status === 'queued').length} tone="queued" icon={<Clock3 size={19} />} />
        <StatCard label="处理中" value={state.tasks.filter((task) => task.status === 'processing').length} tone="processing" icon={<LoaderCircle size={19} />} />
        <StatCard label="成功" value={state.tasks.filter((task) => task.status === 'success').length} tone="success" icon={<CheckCircle2 size={19} />} />
        <StatCard label="失败" value={state.tasks.filter((task) => task.status === 'failed').length} tone="failed" icon={<XCircle size={19} />} />
      </section>
      <section className="panel task-panel admin-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>最近任务</h2><p>按提交时间展示最近 10 条任务。</p></div></div><TaskList tasks={recentTasks} users={state.users} onSelect={setSelectedTask} /></section>
      <TaskDetails task={selectedTask} user={selectedUser} onClose={() => setSelectedTask(null)} />
    </>
  )
}
