import { Pen, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { deleteAdminTask, listAdminTasks, updateAdminTask } from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ModalFrame } from '../../components/ModalFrame'
import { TaskDetails } from '../../components/TaskDetails'
import { TaskList } from '../../components/TaskList'
import { ToastRegion } from '../../components/ToastRegion'
import type { Task, TaskStatus } from '../../domain/models'

type StatusFilter = 'all' | TaskStatus

export function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [error, setError] = useState('')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editUrl, setEditUrl] = useState('')
  const [editAt, setEditAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingTask, setDeletingTask] = useState<Task | null>(null)
  const [feedback, setFeedback] = useState('')

  const refresh = () => {
    listAdminTasks({
      ...(statusFilter === 'all' ? {} : { status: statusFilter }),
      ...(search.trim() ? { search: search.trim() } : {}),
    }).then(setTasks).catch((cause) => setError(cause instanceof Error ? cause.message : '任务加载失败'))
  }

  useEffect(() => {
    const timer = window.setTimeout(refresh, 200)
    return () => window.clearTimeout(timer)
  }, [search, statusFilter])

  const startEdit = (task: Task) => {
    setEditingTask(task)
    setEditUrl(task.url)
    setEditAt(task.at ?? '')
  }

  const saveEdit = async () => {
    if (!editingTask) return
    setSaving(true)
    try {
      const updated = await updateAdminTask(
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
      await deleteAdminTask(deletingTask.publicId!)
      setTasks((current) => current.filter((t) => t.id !== deletingTask.id))
      if (selectedTask?.id === deletingTask.id) setSelectedTask(null)
      setFeedback('任务已删除')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setDeletingTask(null)
    }
  }

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">TASK MONITORING</p><h1>全部任务</h1><p>跨用户查看任务状态和完整时间线。</p></div><strong className="result-count">{tasks.length} 条结果</strong></header>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="panel task-panel admin-panel">
        <div className="panel-heading task-panel-heading"><div><p>管理员可编辑排队任务，或删除排队/失败任务。</p></div><div className="filters"><label className="search-field"><Search size={16} /><span className="sr-only">搜索任务</span><input aria-label="搜索任务" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="编号、链接或密钥备注" /></label><label><span className="sr-only">状态筛选</span><select aria-label="状态筛选" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">全部状态</option><option value="queued">排队中</option><option value="processing">处理中</option><option value="success">成功</option><option value="failed">失败</option></select></label></div></div>
        <TaskList tasks={tasks} users={[]} onSelect={setSelectedTask} onEdit={startEdit} />
      </section>
      <TaskDetails task={selectedTask} onClose={() => setSelectedTask(null)} />

      <ModalFrame open={editingTask !== null} title="编辑任务" onDismiss={() => setEditingTask(null)}>
        <h2>编辑任务</h2>
        <p className="muted">{editingTask?.id}</p>
        <div className="key-create-form">
          <label htmlFor="edit-url">支付链接</label>
          <input id="edit-url" data-autofocus value={editUrl} onChange={(event) => setEditUrl(event.target.value)} maxLength={8192} placeholder="https://pay.example.com/…" autoComplete="off" />
          <small>{editUrl.length}/8192</small>
        </div>
        <div className="key-create-form">
          <label htmlFor="edit-at">AT Token</label>
          <textarea id="edit-at" rows={3} value={editAt} onChange={(event) => setEditAt(event.target.value)} maxLength={8192} placeholder="eyJhbGci…（可选）" autoComplete="off" spellCheck={false} />
          <small>{editAt.length}/8192</small>
        </div>
        <div className="modal-actions">
          <button className="button ghost" disabled={saving} onClick={() => setEditingTask(null)}>取消</button>
          {editingTask && (editingTask.status === 'queued' || editingTask.status === 'failed') ? (
            <button className="button danger" disabled={saving} onClick={() => { setEditingTask(null); setDeletingTask(editingTask) }}>删除任务</button>
          ) : null}
          <button className="button" disabled={saving || !editUrl.trim()} onClick={() => void saveEdit()}>
            <Pen size={17} />{saving ? '保存中…' : '保存修改'}
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
