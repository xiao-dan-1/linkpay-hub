import {
  CheckCircle2,
  Clock3,
  Layers3,
  Link,
  Pen,
  RefreshCw,
  LoaderCircle,
  LogOut,
  Search,
  Send,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkLinkJob, startLinkJob, type Stage } from '../../api/at'
import { deleteTask, listUserTasks, submitTasks, updateTask } from '../../api/tasks'
import { useAuth } from '../../auth/AuthContext'
import { AppShell } from '../../components/AppShell'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ModalFrame } from '../../components/ModalFrame'
import { StatCard } from '../../components/StatCard'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { ToastRegion } from '../../components/ToastRegion'
import type { Task, TaskStatus } from '../../domain/models'
import { extractAccountInfo } from '../../domain/jwt-decode'
import { parseSubmittedLinks } from '../../domain/taskRules'

type StatusFilter = 'all' | TaskStatus

export function UserWorkbenchPage() {
  const navigate = useNavigate()
  const { user, logoutUser } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [rawInput, setRawInput] = useState('')
  const [atInput, setAtInput] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editAt, setEditAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genStages, setGenStages] = useState<Stage[] | null>(null)
  const [creatingLink, setCreatingLink] = useState(false)
  const [linkProgress, setLinkProgress] = useState<{ current: number; total: number } | null>(null)

  const refreshTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      setTasks(await listUserTasks())
    } catch (cause) {
      if (!silent) setFeedback(cause instanceof Error ? cause.message : '任务加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { void refreshTasks() }, [refreshTasks])

  // 5 秒自动刷新（静默）
  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => { void refreshTasks(true) }, 5000)
    return () => window.clearInterval(timer)
  }, [refreshTasks, autoRefresh])

  const parsed = useMemo(() => (
    rawInput
      ? parseSubmittedLinks(rawInput)
      : { valid: [], invalid: [], blankCount: 0, duplicateCount: 0 }
  ), [rawInput])

  if (!user) return null

  const normalized = search.trim().toLowerCase()
  const filteredTasks = tasks.filter((task) => {
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter
    const matchesSearch = !normalized || task.url.toLowerCase().includes(normalized) || task.id.toLowerCase().includes(normalized) || (task.at && task.at.toLowerCase().includes(normalized)) || (task.userLabel && task.userLabel.toLowerCase().includes(normalized))
    return matchesStatus && matchesSearch
  })
  const counts = {
    all: tasks.length,
    queued: tasks.filter((task) => task.status === 'queued').length,
    processing: tasks.filter((task) => task.status === 'processing').length,
    success: tasks.filter((task) => task.status === 'success').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  }
  const hasInvalid = parsed.invalid.length > 0
  const canSubmit = parsed.valid.length > 0 && !hasInvalid && !submitting
  const submitLabel = hasInvalid
    ? '请修正无效链接'
    : parsed.valid.length
      ? submitting ? '正在提交…' : `提交 ${parsed.valid.length} 条任务`
      : '请输入任务链接'

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      // pair URLs with ATs line by line
      const atLines = atInput.split(/\r?\n/).map(l => l.trim())
      const urlLines = rawInput.split(/\r?\n/)
      const atByUrl: Map<string, string> = new Map()
      let urlIdx = 0
      for (const line of urlLines) {
        const url = line.trim()
        if (!url || !url.startsWith('http')) continue
        const at = atLines[urlIdx]?.trim()
        if (at) atByUrl.set(url, at)
        urlIdx++
      }

      // group URLs by AT
      const groups: Map<string, string[]> = new Map()
      for (const url of parsed.valid) {
        const at = atByUrl.get(url) || ''
        if (!groups.has(at)) groups.set(at, [])
        groups.get(at)!.push(url)
      }

      let totalCreated = 0
      for (const [at, urls] of groups) {
        totalCreated += (await submitTasks(urls, at || undefined)).length
      }
      setRawInput('')
      setAtInput('')
      setFeedback(`已创建 ${totalCreated} 条任务`)
      await refreshTasks()
    } catch (cause) {
      setFeedback(`${cause instanceof Error ? cause.message : '提交失败'}；请刷新确认已成功的部分`)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (task: Task) => {
    setEditingTask(task)
    setEditUrl(task.url)
    setEditAt(task.at ?? '')
  }

  const saveEdit = async () => {
    if (!editingTask) return
    setSaving(true)
    try {
      const updated = await updateTask(
        editingTask.publicId!,
        editUrl.trim(),
        editAt.trim() || undefined,
        editingTask.version!,
      )
      setTasks((current) => current.map((t) => t.id === updated.id ? updated : t))
      setSelectedTask((current) => current?.id === updated.id ? updated : current)
      setFeedback('任务已更新')
      setEditingTask(null)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTask) return
    try {
      await deleteTask(deletingTask.publicId!)
      setTasks((current) => current.filter((t) => t.id !== deletingTask.id))
      if (selectedTask?.id === deletingTask.id) setSelectedTask(null)
      setFeedback('任务已删除')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setDeletingTask(null)
    }
  }

  const signOut = async () => {
    await logoutUser()
    navigate('/login')
  }

  return (
    <>
      <AppShell
        title="提交任务"
        subtitle="所有任务只会进入当前账号绑定的工作室"
        eyebrow="USER WORKBENCH"
        actions={<><a className="button ghost" href="/admin/dashboard" style={{textDecoration:'none'}}>管理后台</a><span className="identity-chip">{user.userLabel}</span><button className="button ghost" onClick={() => void signOut()}><LogOut size={17} />退出登录</button></>}
      >
        <section className="workbench-grid">
          <article className="panel submit-panel">
            <div className="panel-heading"><div><p className="eyebrow">TASK SUBMIT</p><h2>创建任务</h2><p>每行输入一条支付链接，数量不限，系统会自动分批提交。</p></div></div>
            <label className="textarea-label" htmlFor="task-at">AT Token</label>
            <textarea id="task-at" className="submit-textarea" rows={3} value={atInput} onChange={(event) => setAtInput(event.target.value)} placeholder="eyJhbGci...（每行一个，与链接一一对应）" />
            <label className="textarea-label" htmlFor="task-links">
              支付链接
              <button className="button compact ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 26, visibility: atInput.trim() ? 'visible' : 'hidden' }} disabled={creatingLink || !atInput.trim()} onClick={async () => {
                setCreatingLink(true)
                try {
                  const atLines = atInput.split(/\r?\n/).filter(l => l.trim())
                  setLinkProgress({ current: 0, total: atLines.length })
                  const results: string[] = []
                  for (let i = 0; i < atLines.length; i++) {
                    const created = await startLinkJob(atLines[i].trim())
                    if (!created.ok || !created.jobId) continue
                    for (let p = 0; p < 30; p++) {
                      await new Promise(r => setTimeout(r, 2000))
                      const job = await checkLinkJob(created.jobId)
                      if (job.status === 'done' && job.pay_url) {
                        results.push(job.pay_url)
                        break
                      }
                      if (job.status === 'failed') break
                    }
                    setLinkProgress({ current: i + 1, total: atLines.length })
                  }
                  if (results.length > 0) {
                    setRawInput((prev) => (prev.trim() ? prev.trim() + '\n' : '') + results.join('\n'))
                    setFeedback(`已生成 ${results.length} 条链接`)
                  } else {
                    setFeedback('未能生成任何链接')
                  }
                } catch (e) {
                  setFeedback(e instanceof Error ? e.message : '生成失败')
                } finally {
                  setCreatingLink(false)
                  setLinkProgress(null)
                }
              }}>
                <Link size={11} />{creatingLink ? '生成中…' : '生成链接'}
              </button>
            </label>
            <textarea id="task-links" className="submit-textarea" aria-label="任务链接" rows={3} value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'https://pay.example.com/…（每行一个支付链接）'} />
          {linkProgress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0', fontSize: 12, color: 'var(--text-muted)' }}>
              <progress value={linkProgress.current} max={linkProgress.total} style={{ flex: 1, height: 4, accentColor: 'var(--primary)' }} />
              <span style={{ whiteSpace: 'nowrap' }}>{linkProgress.current}/{linkProgress.total}</span>
            </div>
          ) : null}
          <div className="validation-row" aria-live="polite">
            <span>有效 {parsed.valid.length} 条</span>
            {parsed.duplicateCount ? <span>已去重 {parsed.duplicateCount} 条</span> : null}
            {parsed.blankCount ? <span>空行 {parsed.blankCount} 条</span> : null}
            {parsed.invalid.length ? <span className="validation-error">无效 {parsed.invalid.length} 条</span> : null}
            {atInput.trim() ? (() => {
              const atLines = atInput.split(/\r?\n/).filter(l => l.trim())
              if (atLines.length === 0) return null
              const info = extractAccountInfo(atLines[0])
              if (info.email) return <span>关联: {info.email}</span>
              return <span>AT {atLines.length} 条</span>
            })() : null}
          </div>
          {parsed.invalid.length ? <div className="invalid-links" role="alert">无效链接：{parsed.invalid.join('、')}</div> : null}
          <div className="submit-footer"><span>同次重复链接自动合并，超过 200 条将自动分批。</span><button className="button submit-button" disabled={!canSubmit} onClick={() => void onSubmit()}><Send size={17} />{submitLabel}</button></div>
          </article>
        </section>
        <section className="stats-grid user-stats">
          <StatCard label="全部任务" value={counts.all} icon={<Layers3 size={19} />} active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          <StatCard label="排队中" value={counts.queued} tone="queued" icon={<Clock3 size={19} />} active={statusFilter === 'queued'} onClick={() => setStatusFilter('queued')} />
          <StatCard label="处理中" value={counts.processing} tone="processing" icon={<LoaderCircle size={19} />} active={statusFilter === 'processing'} onClick={() => setStatusFilter('processing')} />
          <StatCard label="成功" value={counts.success} tone="success" icon={<CheckCircle2 size={19} />} active={statusFilter === 'success'} onClick={() => setStatusFilter('success')} />
          <StatCard label="失败" value={counts.failed} tone="failed" icon={<XCircle size={19} />} active={statusFilter === 'failed'} onClick={() => setStatusFilter('failed')} />
        </section>
        <section className="panel task-panel">
          <div className="panel-heading task-panel-heading">
            <div><p className="eyebrow">PAYMENT LINKS</p><h2>支付链接</h2><p>默认按最新提交在上方排列。</p></div>
            <div className="filters">
              <button className={`button compact ghost${autoRefresh ? '' : ' muted'}`} onClick={() => setAutoRefresh(!autoRefresh)} title={autoRefresh ? '自动刷新中（5s）' : '自动刷新已关闭'}>
                <RefreshCw size={14} className={autoRefresh ? 'icon-spin' : ''} />{autoRefresh ? '5s' : '关'}
              </button>
              <label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号/链接/账号/备注" /></label>
              <label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label>
            </div>
          </div>
          {loading ? <div className="empty-state"><p>正在加载任务…</p></div> : <TaskList tasks={filteredTasks} users={[]} onSelect={setSelectedTask} onEdit={startEdit} />}
        </section>
      </AppShell>
      <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />

      <ModalFrame open={editingTask !== null} title="编辑任务" onDismiss={() => setEditingTask(null)}>
        <h2>编辑任务</h2>
        <p className="muted">{editingTask?.id}</p>
        <div className="key-create-form">
          <label htmlFor="edit-at">AT Token</label>
          <textarea id="edit-at" rows={3} data-autofocus value={editAt} onChange={(event) => setEditAt(event.target.value)} maxLength={8192} placeholder="eyJhbGci…（可选）" autoComplete="off" spellCheck={false} />
          <small>{editAt.length}/8192</small>
        </div>
        <div className="key-create-form">
          <label htmlFor="edit-url">
            支付链接
            <button className="button compact ghost" style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', height: 26, visibility: editAt.trim() ? 'visible' : 'hidden' }} disabled={generating || !editAt.trim()} onClick={async () => {
                setGenerating(true)
                setGenStages(null)
                try {
                  const created = await startLinkJob(editAt.trim())
                  if (!created.ok || !created.jobId) {
                    setFeedback(created.error || '创建任务失败')
                    setGenerating(false)
                    return
                  }
                  for (let i = 0; i < 30; i++) {
                    await new Promise(r => setTimeout(r, 2000))
                    const job = await checkLinkJob(created.jobId)
                    if (job.stages) setGenStages(job.stages)
                    if (job.status === 'done' && job.pay_url) {
                      setEditUrl(job.pay_url)
                      break
                    }
                    if (job.status === 'failed') {
                      setFeedback(job.error || '链接生成失败')
                      break
                    }
                  }
                } catch (e) {
                  setFeedback(e instanceof Error ? e.message : '生成失败')
                } finally { setGenerating(false) }
              }}>
                <Link size={11} />{generating ? '生成中…' : '生成链接'}
              </button>
          </label>
          {genStages && generating ? (
            <div style={{ margin: '6px 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {genStages.map(s => (
                <span key={s.key} style={{ marginRight: 2 }}>
                  <span style={{ color: s.status === 'done' ? 'var(--success)' : s.status === 'running' ? 'var(--primary)' : 'var(--text-subtle)' }}>●</span>
                  {' '}{s.label}
                  {s.status === 'running' ? '…' : ''}
                </span>
              )).reduce((prev, curr, i) => prev === null ? curr : <>{prev} <span style={{color:'var(--border)'}}>→</span> {curr}</> as any, null)}
            </div>
          ) : null}
          <input id="edit-url" value={editUrl} onChange={(event) => setEditUrl(event.target.value)} maxLength={8192} placeholder="https://pay.example.com/…" autoComplete="off" />
          <small>{editUrl.length}/8192</small>
        </div>
        <div className="modal-actions">
          <button className="button ghost" disabled={saving} onClick={() => setEditingTask(null)}>取消</button>
          {editingTask && (editingTask.status === 'queued' || editingTask.status === 'failed') ? (
            <button className="button danger" disabled={saving} onClick={() => { setEditingTask(null); setDeletingTask(editingTask) }}>删除任务</button>
          ) : null}
          <button className="button" disabled={saving || !editUrl.trim()} onClick={() => void saveEdit()}>
            <Pen size={17} />{saving ? '保存中…' : (editingTask && (editingTask.status === 'failed' || new Date(editingTask.submittedAt).getTime() + 15 * 60 * 1000 < Date.now()) ? '保存并提交' : '保存')}
          </button>
        </div>
      </ModalFrame>

      <ConfirmDialog
        open={deletingTask !== null}
        title="确认删除任务"
        description={`删除后任务 ${deletingTask?.id ?? ''} 将永久移除且不可恢复。`}
        confirmLabel="确认删除"
        tone="danger"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeletingTask(null)}
      />

      <ToastRegion message={feedback} />
    </>
  )
}
