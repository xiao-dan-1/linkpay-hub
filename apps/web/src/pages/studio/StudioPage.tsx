import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Link2,
  LoaderCircle,
  Search,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exchangeStudioToken, getStudioSession } from '../../api/auth'
import { ApiError } from '../../api/client'
import {
  completeStudioTask,
  listStudioTasks,
  nextStudioTask,
  openStudioTask,
} from '../../api/tasks'
import { AppShell } from '../../components/AppShell'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { ToastRegion } from '../../components/ToastRegion'
import type { Task, TaskStatus } from '../../domain/models'
import { InvalidStudioPage } from '../InvalidStudioPage'

type StatusFilter = 'all' | TaskStatus

function isToday(value?: string) {
  return Boolean(value) && new Date(value!).toDateString() === new Date().toDateString()
}

export function StudioPage() {
  const { accessToken } = useParams()
  const navigate = useNavigate()
  const [authorized, setAuthorized] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [processingFeedback, setProcessingFeedback] = useState('')
  const [pendingResult, setPendingResult] = useState<'success' | 'failed' | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)

  const refreshTasks = useCallback(async () => {
    const items = await listStudioTasks()
    setTasks(items)
    return items
  }, [])

  useEffect(() => {
    let active = true
    const initialize = async () => {
      try {
        if (accessToken) {
          await exchangeStudioToken(accessToken)
          navigate('/studio/workbench', { replace: true })
        } else {
          await getStudioSession()
        }
        if (!active) return
        setAuthorized(true)
        await refreshTasks()
      } catch {
        if (active) setInvalid(true)
      } finally {
        if (active) setLoading(false)
      }
    }
    void initialize()
    return () => { active = false }
  }, [accessToken, navigate, refreshTasks])

  const normalized = search.trim().toLowerCase()
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesSearch = !normalized || task.url.toLowerCase().includes(normalized) || task.id.toLowerCase().includes(normalized) || (task.at && task.at.toLowerCase().includes(normalized)) || (task.userLabel && task.userLabel.toLowerCase().includes(normalized))
    return matchesStatus && matchesSearch
  })
  const counts = {
    queued: tasks.filter((task) => task.status === 'queued').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
    success: tasks.filter((task) => task.status === 'success' && isToday(task.completedAt)).length,
    failed: tasks.filter((task) => task.status === 'failed' && isToday(task.completedAt)).length,
  }

  const selectTask = async (task: Task) => {
    try {
      const opened = await openStudioTask(task.id)
      setSelectedTask(opened)
      setProcessingFeedback(opened.feedback ?? '')
      if (task.status === 'queued') setFeedback(`${task.id} 已开始处理`)
      setTasks((current) => current.map((item) => item.id === opened.id ? opened : item))
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '任务打开失败')
    }
  }

  const openNext = async () => {
    if (!selectedTask) return
    try {
      const next = await nextStudioTask(selectedTask.id)
      if (!next) {
        setFeedback('已是最后一个任务')
        return
      }
      setSelectedTask(next)
      setProcessingFeedback(next.feedback ?? '')
      setTasks((current) => current.map((item) => item.id === next.id ? next : item))
      setFeedback(`${next.id} 已开始处理`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '下一个任务打开失败')
    }
  }

  const completeTask = async () => {
    if (!selectedTask || !pendingResult || selectedTask.version === undefined) return
    try {
      const updated = await completeStudioTask(
        selectedTask.id,
        pendingResult,
        selectedTask.version,
        processingFeedback,
      )
      setSelectedTask(updated)
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item))
      setFeedback(pendingResult === 'success' ? '任务已处理成功' : '任务已处理失败')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        const current = await openStudioTask(selectedTask.id)
        setSelectedTask(current)
        setFeedback('任务已被其他操作更新，已刷新最新状态')
      } else {
        setFeedback(cause instanceof Error ? cause.message : '任务反馈失败')
      }
    } finally {
      setPendingResult(null)
    }
  }

  if (loading) return <div className="route-loading">正在进入工作室…</div>
  if (invalid || !authorized) return <InvalidStudioPage />

  return (
    <>
      <AppShell title="工作室工作台" subtitle="打开排队任务时将自动进入处理中状态" eyebrow="STUDIO WORKBENCH" actions={<div className="queue-indicator"><span>当前排队</span><strong>{counts.queued}</strong></div>}>
        <section className="stats-grid studio-stats">
          <StatCard label="排队中" value={counts.queued} tone="queued" icon={<Clock3 size={19} />} active={statusFilter === 'queued'} onClick={() => setStatusFilter(statusFilter === 'queued' ? 'all' : 'queued')} />
          <StatCard label="处理中" value={counts.processing} tone="processing" icon={<LoaderCircle size={19} />} active={statusFilter === 'processing'} onClick={() => setStatusFilter(statusFilter === 'processing' ? 'all' : 'processing')} />
          <StatCard label="今日成功" value={counts.success} tone="success" icon={<CheckCircle2 size={19} />} active={statusFilter === 'success'} onClick={() => setStatusFilter(statusFilter === 'success' ? 'all' : 'success')} />
          <StatCard label="今日失败" value={counts.failed} tone="failed" icon={<XCircle size={19} />} active={statusFilter === 'failed'} onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')} />
        </section>
        <section className="panel task-panel studio-task-panel">
          <div className="panel-heading task-panel-heading">
            <div><p className="eyebrow">PROCESSING QUEUE</p><h2>任务队列</h2><p>越下越新，优先处理最早进入队列的任务。</p></div>
            <div className="filters">
              <label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号/链接/账号/备注" /></label>
              <label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label>
            </div>
          </div>
          <div className="queue-note"><Link2 size={16} /><span>当前入口仅展示此工作室的任务，队列不会跨工作室流转。</span></div>
          <TaskList tasks={filteredTasks} users={[]} onSelect={(task) => void selectTask(task)} />
        </section>
      </AppShell>
      <TaskDetails
        task={selectedTask}
        onClose={() => { setSelectedTask(null); setProcessingFeedback('') }}
        actions={selectedTask ? (
          <div className="studio-detail-actions">
            {selectedTask.status === 'processing' ? <div className="studio-feedback-fields"><label htmlFor="processing-feedback">处理反馈（可选）</label><textarea id="processing-feedback" value={processingFeedback} onChange={(event) => setProcessingFeedback(event.target.value)} rows={3} placeholder="填写需要同步给用户的处理说明" /></div> : null}
            <div className="studio-action-row">
              <button className="button ghost" onClick={() => void openNext()}>下一个任务<ChevronRight size={17} /></button>
              {selectedTask.status === 'processing' ? <div className="result-action-buttons"><button className="button danger" onClick={() => setPendingResult('failed')}><XCircle size={17} />处理失败</button><button className="button" onClick={() => setPendingResult('success')}><CheckCircle2 size={17} />处理成功</button></div> : null}
            </div>
          </div>
        ) : undefined}
      />
      <ConfirmDialog open={pendingResult !== null} title={pendingResult === 'success' ? '确认处理成功' : '确认处理失败'} description="完成后任务将进入不可逆的终态，请确认处理结果。" confirmLabel={pendingResult === 'success' ? '确认成功' : '确认失败'} tone={pendingResult === 'success' ? 'primary' : 'danger'} onConfirm={() => void completeTask()} onCancel={() => setPendingResult(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
