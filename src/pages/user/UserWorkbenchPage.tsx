import {
  CheckCircle2,
  Clock3,
  Layers3,
  Link2,
  ListPlus,
  LoaderCircle,
  LogOut,
  Search,
  Send,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { ToastRegion } from '../../components/ToastRegion'
import { useAuth } from '../../auth/AuthContext'
import { useData } from '../../data/DataContext'
import type { Task, TaskStatus } from '../../domain/models'
import { parseSubmittedLinks } from '../../domain/taskRules'

type SubmissionMode = 'single' | 'batch'
type StatusFilter = 'all' | TaskStatus

export function UserWorkbenchPage() {
  const navigate = useNavigate()
  const { user, logoutUser } = useAuth()
  const { repository, refresh } = useData()
  const [mode, setMode] = useState<SubmissionMode>('single')
  const [rawInput, setRawInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [feedback, setFeedback] = useState('')

  if (!user) return null

  const state = repository.getState()
  const studio = state.studios.find((item) => item.id === user.studioId)
  const tasks = repository.getUserTasks(user.id)

  let parsed = { valid: [] as string[], invalid: [] as string[], blankCount: 0, duplicateCount: 0 }
  let parseError = ''
  try {
    parsed = rawInput ? parseSubmittedLinks(rawInput) : parsed
  } catch (cause) {
    parseError = cause instanceof Error ? cause.message : '链接解析失败'
  }

  const normalized = search.trim().toLowerCase()
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesSearch =
      !normalized ||
      task.url.toLowerCase().includes(normalized) ||
      task.id.toLowerCase().includes(normalized)
    return matchesStatus && matchesSearch
  })

  const counts = {
    all: tasks.length,
    queued: tasks.filter((task) => task.status === 'queued').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
    success: tasks.filter((task) => task.status === 'success').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  }

  const hasInvalid = Boolean(parsed.invalid.length || parseError)
  const canSubmit = parsed.valid.length > 0 && !hasInvalid
  const submitLabel = hasInvalid
    ? '请修正无效链接'
    : parsed.valid.length
      ? `提交 ${parsed.valid.length} 条任务`
      : '请输入任务链接'

  const submitTasks = () => {
    if (!canSubmit) return
    const created = repository.createTasks(user.id, parsed.valid)
    refresh()
    setRawInput('')
    setFeedback(`已创建 ${created.length} 条任务`)
  }

  const signOut = () => {
    logoutUser()
    navigate('/login')
  }

  return (
    <>
      <AppShell
        title="提交任务"
        subtitle={`任务将只进入 ${studio?.name ?? '所属工作室'} 的专属队列`}
        eyebrow="USER WORKBENCH"
        actions={<><span className="identity-chip">{user.username}</span><button className="button ghost" onClick={signOut}><LogOut size={17} />退出登录</button></>}
      >
        <section className="workbench-grid">
          <article className="panel submit-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">TASK SUBMIT</p><h2>创建任务</h2><p>支持单条提交和每行一条的批量提交。</p></div>
              <div className="segmented-control" aria-label="提交模式">
                <button className={mode === 'single' ? 'active' : ''} onClick={() => { setMode('single'); setRawInput('') }}><Link2 size={16} />单条提交</button>
                <button className={mode === 'batch' ? 'active' : ''} onClick={() => { setMode('batch'); setRawInput('') }}><ListPlus size={16} />批量提交</button>
              </div>
            </div>
            <label className="textarea-label" htmlFor="task-links">任务链接</label>
            <textarea
              id="task-links"
              aria-label="任务链接"
              rows={mode === 'batch' ? 8 : 4}
              value={rawInput}
              onChange={(event) => setRawInput(event.target.value)}
              placeholder={mode === 'batch' ? 'https://example.com/task-1\nhttps://example.com/task-2' : 'https://example.com/task'}
            />
            <div className="validation-row" aria-live="polite">
              <span>有效 {parsed.valid.length} 条</span>
              {parsed.duplicateCount ? <span>已去重 {parsed.duplicateCount} 条</span> : null}
              {parsed.blankCount ? <span>空行 {parsed.blankCount} 条</span> : null}
              {parsed.invalid.length ? <span className="validation-error">无效 {parsed.invalid.length} 条</span> : null}
              {parseError ? <span className="validation-error">{parseError}</span> : null}
            </div>
            {parsed.invalid.length ? <div className="invalid-links" role="alert">无效链接：{parsed.invalid.join('、')}</div> : null}
            <div className="submit-footer"><span>单次最多 10 条，同次重复链接自动合并。</span><button className="button submit-button" disabled={!canSubmit} onClick={submitTasks}><Send size={17} />{submitLabel}</button></div>
          </article>
          <aside className="panel studio-summary">
            <p className="eyebrow">BOUND STUDIO</p>
            <h2>{studio?.name ?? '演示工作室'}</h2>
            <p>当前账号已绑定该工作室。所有新任务只会进入此工作室队列。</p>
            <div className="summary-line"><span>当前排队</span><strong>{counts.queued}</strong></div>
            <div className="summary-line"><span>处理中</span><strong>{counts.processing}</strong></div>
          </aside>
        </section>

        <section className="stats-grid user-stats">
          <StatCard label="全部任务" value={counts.all} icon={<Layers3 size={19} />} />
          <StatCard label="排队中" value={counts.queued} tone="queued" icon={<Clock3 size={19} />} />
          <StatCard label="处理中" value={counts.processing} tone="processing" icon={<LoaderCircle size={19} />} />
          <StatCard label="成功" value={counts.success} tone="success" icon={<CheckCircle2 size={19} />} />
          <StatCard label="失败" value={counts.failed} tone="failed" icon={<XCircle size={19} />} />
        </section>

        <section className="panel task-panel">
          <div className="panel-heading task-panel-heading">
            <div><p className="eyebrow">MY TASKS</p><h2>我的任务</h2><p>查看提交记录与工作室处理进度。</p></div>
            <div className="filters">
              <label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="任务编号或链接" /></label>
              <label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label>
            </div>
          </div>
          <TaskList tasks={filteredTasks} users={[]} onSelect={setSelectedTask} />
        </section>
      </AppShell>
      <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
