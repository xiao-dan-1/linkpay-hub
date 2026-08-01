import {
  Copy,
  KeyRound,
  Plus,
  Search,
  ShieldCheck,
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
import { createUserKey, listUsers, setUserEnabled } from '../../api/admin'
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
  const [createOpen, setCreateOpen] = useState(false)
  const [note, setNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Awaited<ReturnType<typeof createUserKey>> | null>(null)
  const [feedback, setFeedback] = useState('')

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
      const result = await createUserKey(note)
      setUsers((current) => [result.user, ...current])
      setCreateOpen(false)
      setNote('')
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
          return <tr key={user.id}><td data-label="密钥"><span className="key-identity"><span className="user-avatar"><KeyRound size={16} /></span><code className="key-mask">{user.maskedKey}</code></span></td><td data-label="备注"><span className={user.note ? 'key-note' : 'muted'}>{user.note || '—'}</span></td><td data-label="状态"><span className={`account-status ${user.enabled ? 'enabled' : 'disabled'}`}>{user.enabled ? '已启用' : '已停用'}</span></td><td data-label="创建时间">{formatDate(user.createdAt)}</td><td data-label="最近使用">{formatDate(user.lastUsedAt ?? undefined)}</td><td data-label="任务数">{user.taskCount}</td><td data-label="操作">{user.enabled ? <button className="button danger compact" aria-label={`停用 ${name}`} onClick={() => setPendingDisable(user)}><UserRoundX size={16} />停用</button> : <button className="button secondary compact" aria-label={`启用 ${name}`} onClick={() => void setEnabled(user, true)}><UserRoundCheck size={16} />启用</button>}</td></tr>
        })}</tbody></table></div>
      </section>

      <ModalFrame open={createOpen} title="创建用户密钥" onDismiss={() => { if (!creating) setCreateOpen(false) }}>
        <div className="key-modal-icon"><KeyRound size={22} /></div>
        <h2>创建用户密钥</h2>
        <p>备注可用于区分客户、渠道或用途，用户登录时只需输入生成的密钥。</p>
        <label className="key-create-form"><span>密钥备注（可选）</span><textarea data-autofocus aria-label="密钥备注（可选）" value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={4} placeholder="例如：客户 A / 直播工作室" /><small>{note.length}/200</small></label>
        <div className="modal-actions"><button className="button secondary" disabled={creating} onClick={() => setCreateOpen(false)}>取消</button><button className="button" disabled={creating} onClick={() => void createKey()}><ShieldCheck size={17} />{creating ? '正在生成…' : '生成密钥'}</button></div>
      </ModalFrame>

      <ModalFrame open={created !== null} title="密钥已创建" dismissible={false} onDismiss={() => undefined}>
        <div className="key-modal-icon success"><ShieldCheck size={22} /></div>
        <h2>密钥已创建</h2>
        <p className="key-warning">完整密钥只显示这一次，请立即复制保存。</p>
        {created ? <div className="key-reveal"><code className="key-value">{created.accessKey}</code><button data-autofocus className="button secondary" aria-label="复制密钥" onClick={() => void copyCreatedKey()}><Copy size={17} />复制密钥</button></div> : null}
        <div className="modal-actions"><button className="button" onClick={() => setCreated(null)}>我已保存</button></div>
      </ModalFrame>

      <ConfirmDialog open={pendingDisable !== null} title="确认停用密钥" description={`停用后 ${pendingDisable ? userDisplayName(pendingDisable) : ''} 将不能登录或提交任务，历史任务会继续保留。`} confirmLabel="确认停用" onConfirm={() => { if (pendingDisable) void setEnabled(pendingDisable, false); setPendingDisable(null) }} onCancel={() => setPendingDisable(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
