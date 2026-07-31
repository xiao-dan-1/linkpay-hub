import { Search, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { listUsers, setUserEnabled } from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import { formatDate } from '../../components/TaskList'
import type { User } from '../../domain/models'

export function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState('')
  const [pendingDisable, setPendingDisable] = useState<User | null>(null)
  const [feedback, setFeedback] = useState('')

  const loadUsers = useCallback(async () => {
    try { setUsers(await listUsers(search.trim())) }
    catch (cause) { setFeedback(cause instanceof Error ? cause.message : '用户加载失败') }
  }, [search])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadUsers() }, 200)
    return () => window.clearTimeout(timer)
  }, [loadUsers])

  const setEnabled = async (user: User, enabled: boolean) => {
    try {
      const updated = await setUserEnabled(user.id, enabled)
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setFeedback(enabled ? `${user.username} 已启用` : `${user.username} 已停用并注销现有会话`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '用户状态更新失败')
    }
  }

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">USER MANAGEMENT</p><h1>用户管理</h1><p>查看注册用户并控制账号是否可以登录和提交。</p></div><strong className="result-count">{users.length} 位用户</strong></header>
      <section className="panel admin-panel user-management-panel">
        <div className="panel-heading task-panel-heading"><div><h2>用户账号</h2><p>停用账号会保留历史任务，并注销当前登录会话。</p></div><label className="search-field"><Search size={16} /><span className="sr-only">搜索用户</span><input aria-label="搜索用户" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="输入用户名" /></label></div>
        <div className="user-table-wrap"><table className="user-table"><thead><tr><th>用户</th><th>账号状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td data-label="用户"><span className="user-name"><span className="user-avatar">{user.username.slice(0, 1).toUpperCase()}</span>{user.username}</span></td><td data-label="账号状态"><span className={`account-status ${user.enabled ? 'enabled' : 'disabled'}`}>{user.enabled ? '已启用' : '已停用'}</span></td><td data-label="注册时间">{formatDate(user.createdAt)}</td><td data-label="操作">{user.enabled ? <button className="button danger compact" aria-label={`停用 ${user.username}`} onClick={() => setPendingDisable(user)}><UserRoundX size={16} />停用</button> : <button className="button secondary compact" aria-label={`启用 ${user.username}`} onClick={() => void setEnabled(user, true)}><UserRoundCheck size={16} />启用</button>}</td></tr>)}</tbody></table></div>
      </section>
      <ConfirmDialog open={pendingDisable !== null} title="确认停用用户" description={`停用后 ${pendingDisable?.username ?? ''} 将不能登录或提交任务，历史任务会继续保留。`} confirmLabel="确认停用" onConfirm={() => { if (pendingDisable) void setEnabled(pendingDisable, false); setPendingDisable(null) }} onCancel={() => setPendingDisable(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
