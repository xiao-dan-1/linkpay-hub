import { CheckCircle2, Clock3, ClipboardList, LoaderCircle, Users, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDashboard, getTrends, listAdminTasks } from '../../api/admin'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { TrendCharts } from '../../components/TrendCharts'
import type { Task } from '../../domain/models'
import type { TrendsResponse } from '@linkpay/contracts'

const emptyDashboard = { users: 0, tasks: 0, queued: 0, processing: 0, success: 0, failed: 0 }

export function AdminDashboard() {
  const [dashboard, setDashboard] = useState(emptyDashboard)
  const [tasks, setTasks] = useState<Task[]>([])
  const [trends, setTrends] = useState<TrendsResponse>({ daily: [] })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getDashboard(), getTrends(), listAdminTasks()])
      .then(([counts, trendData, items]) => {
        setDashboard(counts)
        setTrends(trendData)
        setTasks(items.slice(0, 10))
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : '数据加载失败'))
  }, [])

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">ADMIN OVERVIEW</p><h1>数据概览</h1><p>查看用户规模与任务状态分布。</p></div><span className="identity-chip">正式环境</span></header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="stats-grid admin-stats">
        <StatCard label="用户总数" value={dashboard.users} icon={<Users size={19} />} />
        <StatCard label="任务总数" value={dashboard.tasks} icon={<ClipboardList size={19} />} />
        <StatCard label="排队中" value={dashboard.queued} tone="queued" icon={<Clock3 size={19} />} />
        <StatCard label="处理中" value={dashboard.processing} tone="processing" icon={<LoaderCircle size={19} />} />
        <StatCard label="成功" value={dashboard.success} tone="success" icon={<CheckCircle2 size={19} />} />
        <StatCard label="失败" value={dashboard.failed} tone="failed" icon={<XCircle size={19} />} />
      </section>
      <TrendCharts daily={trends.daily} />
      <section className="panel task-panel admin-panel"><div className="panel-heading"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>最近任务</h2><p>按提交顺序展示最近 10 条任务。</p></div></div><TaskList tasks={tasks} users={[]} onSelect={setSelectedTask} /></section>
      <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />
    </>
  )
}
