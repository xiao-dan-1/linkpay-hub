import {
  Copy,
  KeyRound,
  Pen,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UserRoundX,
} from 'lucide-react'
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createUserKey, deleteUser, listUsers, revealUserKey, setUserEnabled, updateUserKey } from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import { formatDate } from '../../components/TaskList'
import type { User } from '../../domain/models'

function ModalFrame({
  open,
  title,
  dismissible = true,
  onDismiss,
  children,
}: PropsWithChildren<{
  open: boolean
  title: string
  dismissible?: boolean
  onDismiss: () => void
}>) {
  const modalRef = useRef<HTMLElement | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => {
      modalRef.current?.querySelector<HTMLElement>('[data-autofocus], input, textarea, button')?.focus()
    })
    const onKeyDown = (event: KeyboardEvent) => {
      if (dismissible && event.key === 'Escape') onDismissRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [dismissible, open])

  if (!open) return null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onDismissRef.current()
      }}
    >
      <section ref={modalRef} className="modal key-modal" role="dialog" aria-modal="true" aria-label={title}>
        {children}
      </section>
    </div>
  )
}

function userDisplayName(user: User) {
  return user.note || user.maskedKey
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [pendingDisable, setPendingDisable] = useState<User | null>(null)
  const [pendingDelete, setPendingDelete] = useState<User | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [note, setNote] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Awaited<ReturnType<typeof createUserKey>> | null>(null)
  const [feedback, setFeedback] = useState('')
  const [editing, setEditing] = useState<User | null>(null)
  const [editNote, setEditNote] = useState('')
  const [editKey, setEditKey] = useState('')

  const loadUsers = useCallback(async () => {
    try { setUsers(await listUsers(search.trim())) }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : '密钥加载失败') }
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers() }, 200)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const setEnabled = async (user: User, enabled: boolean) => {
    try {
      const updated = await setUserEnabled(user.id, enabled)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      const name = userDisplayName(user)
      setFeedback(enabled ? `${name} 已启用` : `${name} 已停用并注销现有会话`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '密钥状态更新失败')
    }
  }

  const createKey = async () => {
    setCreating(true)
    try {
      const result = await createUserKey(note, customKey)
      setUsers((current) => [result.user, ...current])
      setCreateOpen(false)
      setNote('')
      setCustomKey('')
      setCreated(result)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '密钥创建失败')
    } finally {
      setCreating(false)
    }
  }

  const copyCreatedKey = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.accessKey)
      setFeedback('密钥已复制，请立即妥善保存')
    } catch {
      setFeedback('复制失败，请手动复制；此窗口关闭后不再显示完整密钥')
    }
  }

  const saveEdit = async () => {
    if (!editing) return
    try {
      const data: { note?: string; key?: string } = {}
      if (editNote !== (editing.note || '')) data.note = editNote
      if (editKey.trim()) data.key = editKey.trim()
      const updated = await updateUserKey(editing.id, data)
      setUsers((c) => c.map((u) => u.id === updated.id ? updated : u))
      setFeedback(`${userDisplayName(editing)} 已更新`)
      setEditing(null)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '更新失败')
    }
  }

  const startEdit = (user: User) => {
    setEditing(user)
    setEditNote(user.note || '')
    setEditKey('')
  }

  const copyKey = async (user: User) => {
    try {
      const { accessKey } = await revealUserKey(user.id)
      await navigator.clipboard.writeText(accessKey)
      setFeedback(`完整密钥已复制（${userDisplayName(user)}）`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '复制失败')
    }
  }

  const removeUser = async () => {
    if (!pendingDelete) return
    try {
      await deleteUser(pendingDelete.id)
      setUsers((current) => current.filter((item) => item.id !== pendingDelete.id))
      setFeedback(`${userDisplayName(pendingDelete)} 已删除`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '删除失败')
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <>
      <header className="admin-page-header">
        <div><p className="eyebrow">KEY MANAGEMENT</p><h1>密钥管理</h1><p>创建用户访问密钥，添加备注并控制登录权限。</p></div>
        <div className="header-actions"><strong className="result-count">{users.length} 个密钥</strong><button className="button" onClick={() => setCreateOpen(true)}><Plus size={17} />创建密钥</button></div>
      </header>
      <section className="panel admin-panel user-management-panel">
        <div className="panel-heading task-panel-heading"><div><h2>用户访问密钥</h2><p>完整密钥只在创建成功时展示一次；停用会注销该密钥的现有会话。</p></div><label className="search-field"><Search size={16} /><span className="sr-only">搜索密钥</span><input aria-label="搜索密钥" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索备注、前缀或尾号" /></label></div>
        <div className="user-table-wrap"><table className="user-table key-table"><thead><tr><th>密钥</th><th>备注</th><th>状态</th><th>创建时间</th><th>最近使用</th><th>任务数</th><th>操作</th></tr></thead><tbody>{users.map((user) => {
          const name = userDisplayName(user)
          return <tr key={user.id}><td data-label="密钥"><span className="key-identity"><span className="user-avatar"><KeyRound size={16} /></span><code className="key-mask">{user.maskedKey}</code><button className="icon-button" style={{marginLeft: 6, width: 30, height: 30}} aria-label={`复制 ${name}`} onClick={() => void copyKey(user)}><Copy size={14} /></button></span></td><td data-label="备注"><span className={user.note ? 'key-note' : 'muted'}>{user.note || '—'}</span></td><td data-label="状态"><span className={`account-status ${user.enabled ? 'enabled' : 'disabled'}`}>{user.enabled ? '已启用' : '已停用'}</span></td><td data-label="创建时间">{formatDate(user.createdAt)}</td><td data-label="最近使用">{formatDate(user.lastUsedAt ?? undefined)}</td><td data-label="任务数">{user.taskCount}</td><td data-label="操作"><span className="row-actions"><button className="icon-button" aria-label={`编辑 ${name}`} onClick={() => startEdit(user)}><Pen size={15} /></button>{user.enabled ? <button className="button danger compact" aria-label={`停用 ${name}`} onClick={() => setPendingDisable(user)}><UserRoundX size={16} />停用</button> : <button className="button secondary compact" aria-label={`启用 ${name}`} onClick={() => void setEnabled(user, true)}><UserRoundCheck size={16} />启用</button>}<button className="icon-button danger-icon" aria-label={`删除 ${name}`} onClick={() => setPendingDelete(user)}><Trash2 size={16} /></button></span></td></tr>
        })}</tbody></table></div>
      </section>

      {/* Edit modal */}
      <ModalFrame open={editing !== null} title="编辑密钥" onDismiss={() => setEditing(null)}>
        <div className="key-modal-icon"><KeyRound size={22} /></div>
        <h2>编辑密钥</h2>
        <p>{editing ? userDisplayName(editing) : ''}</p>
        <div className="key-create-form">
          <label htmlFor="edit-note">备注</label>
          <input id="edit-note" data-autofocus value={editNote} onChange={e => setEditNote(e.target.value)} maxLength={200} placeholder="用于区分任务来源" autoComplete="off" />
          <small>{editNote.length}/200</small>
        </div>
        <div className="key-create-form">
          <label htmlFor="edit-key">自定义密钥</label>
          <input id="edit-key" value={editKey} onChange={e => setEditKey(e.target.value)} maxLength={64} placeholder="留空不改密钥值" autoComplete="off" spellCheck={false} />
          <small>留空则密钥值保持不变</small>
        </div>
        <div className="modal-actions">
          <button className="button ghost" onClick={() => setEditing(null)}>取消</button>
          <button className="button" onClick={() => void saveEdit()}><Pen size={17} />保存修改</button>
        </div>
      </ModalFrame>

      <ModalFrame open={createOpen} title="创建用户密钥" onDismiss={() => { if (!creating) setCreateOpen(false) }}>
        <div className="key-modal-icon"><KeyRound size={22} /></div>
        <h2>创建用户密钥</h2>
        <p>密钥为用户登录凭证。</p>
        <div className="key-create-form">
          <label htmlFor="key-note">备注</label>
          <input id="key-note" data-autofocus value={note} onChange={e => setNote(e.target.value)} maxLength={200} placeholder="用于区分任务来源，可在任务列表按备注搜索" autoComplete="off" />
          <small>{note.length}/200</small>
        </div>
        <div className="key-create-form">
          <label htmlFor="key-value">自定义密钥</label>
          <input id="key-value" value={customKey} onChange={e => setCustomKey(e.target.value)} maxLength={64} placeholder="留空自动生成" autoComplete="off" spellCheck={false} />
          <small>4-64 位，留空则自动生成</small>
        </div>
        <div className="modal-actions">
          <button className="button ghost" disabled={creating} onClick={() => { setCreateOpen(false); setNote(''); setCustomKey('') }}>取消</button>
          <button className="button" disabled={creating} onClick={() => void createKey()}><ShieldCheck size={17} />{creating ? '生成中…' : '生成密钥'}</button>
        </div>
      </ModalFrame>

      <ModalFrame open={created !== null} title="密钥已创建" dismissible={false} onDismiss={() => undefined}>
        <div className="key-modal-icon success"><ShieldCheck size={22} /></div>
        <h2>密钥已创建</h2>
        <p className="key-warning">完整密钥仅显示一次，请立即复制并妥善保存。</p>
        {created ? (
          <div className="key-reveal">
            <code className="key-value">{created.accessKey}</code>
            <button data-autofocus className="button" aria-label="复制密钥" onClick={() => void copyCreatedKey()}><Copy size={17} />复制密钥</button>
          </div>
        ) : null}
        <div className="modal-actions"><button className="button ghost" onClick={() => setCreated(null)}>我已保存</button></div>
      </ModalFrame>

      <ConfirmDialog open={pendingDisable !== null} title="确认停用密钥" description={`停用后 ${pendingDisable ? userDisplayName(pendingDisable) : ''} 将不能登录或提交任务，历史任务会继续保留。`} confirmLabel="确认停用" onConfirm={() => { if (pendingDisable) void setEnabled(pendingDisable, false); setPendingDisable(null) }} onCancel={() => setPendingDisable(null)} />
      <ConfirmDialog open={pendingDelete !== null} title="确认删除密钥" description={`删除后 ${pendingDelete ? userDisplayName(pendingDelete) : ''} 将永久移除；若名下有任务记录将无法删除，可改用「停用」。`} confirmLabel="确认删除" onConfirm={() => void removeUser()} onCancel={() => setPendingDelete(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
