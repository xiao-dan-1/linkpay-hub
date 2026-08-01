import { Building2, ExternalLink, Plus, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createStudio, getDashboard, listStudios, rotateAccess, updateStudio } from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import type { Studio } from '../../domain/models'

export function AdminStudioPage() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [userCount, setUserCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [pendingRotate, setPendingRotate] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    try {
      const [all, dashboard] = await Promise.all([listStudios(), getDashboard()])
      setStudios(all)
      setUserCount(dashboard.users)
      setTaskCount(dashboard.tasks)
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : '加载失败') }
  }
  useEffect(() => { void load() }, [])

  const saveName = async (id: string) => {
    if (!editName.trim()) return
    try {
      const u = await updateStudio(id, editName.trim())
      setStudios(s => s.map(st => st.id === u.id ? u : st))
      setEditId(null); setFeedback('已保存')
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : '保存失败') }
  }

  const doRotate = async () => {
    if (!pendingRotate) return
    try {
      const url = await rotateAccess(pendingRotate)
      setStudios(s => s.map(st => st.id === pendingRotate ? { ...st, entryUrl: url } : st))
      navigator.clipboard.writeText(url).catch(() => {})
      setFeedback('新入口已生成并复制到剪贴板')
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : '轮换失败') }
    finally { setPendingRotate(null) }
  }

  const doCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const { studio: s, accessToken } = await createStudio(newName.trim())
      setStudios(prev => [...prev, s])
      setNewName('')
      await navigator.clipboard.writeText(`${window.location.origin}/studio/${accessToken}`)
      setFeedback('已创建，入口链接已复制到剪贴板')
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : '创建失败') }
    finally { setCreating(false) }
  }

  return (
    <>
      <header className="admin-page-header">
        <div><p className="eyebrow">STUDIO SETTINGS</p><h1>工作室管理</h1><p>管理所有工作室及其访问入口。</p></div>
        <div className="header-actions">
          <strong className="result-count">{studios.length} 个工作室</strong>
          <button className="button" onClick={() => { setShowCreate(true); setNewName('') }}><Plus size={17} />创建工作室</button>
        </div>
      </header>

      {/* 新增行 */}
      {showCreate ? (
        <section className="panel" style={{ padding: '14px 18px', marginBottom: 14, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap', fontSize: 13 }}>新增工作室</span>
          <input style={{ flex: 1, minHeight: 42, padding: '0 12px', border: '1px solid var(--border-strong)', borderRadius: 10, outline: 0, fontSize: 14, fontFamily: 'inherit' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="工作室名称" onKeyDown={e => { if (e.key === 'Enter') void doCreate() }} autoFocus />
          <button className="button" disabled={creating || !newName.trim()} onClick={() => void doCreate()}><Plus size={17} />{creating ? '…' : '创建'}</button>
          <button className="button ghost compact" onClick={() => setShowCreate(false)}>取消</button>
        </section>
      ) : null}

      <section className="panel user-management-panel" style={{ padding: 18 }}>
        <h2 style={{ margin: '0 0 14px' }}>工作室列表</h2>
        <div className="user-table-wrap">
          <table className="user-table key-table">
            <thead><tr><th>名称</th><th>状态</th><th>用户 / 任务</th><th>创建时间</th><th>入口链接</th><th>操作</th></tr></thead>
            <tbody>
              {studios.map(s => (
                <tr key={s.id}>
                  <td data-label="名称">
                    {editId === s.id ? (
                      <span style={{ display: 'flex', gap: 6 }}><input className="key-edit-input" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void saveName(s.id); if (e.key === 'Escape') setEditId(null) }} autoFocus /><button className="button compact" onClick={() => void saveName(s.id)}><Save size={14} />保存</button></span>
                    ) : (
                      <span className="key-note" style={{ cursor: 'pointer' }} onClick={() => { setEditId(s.id); setEditName(s.name) }} title="点击编辑">{s.name}</span>
                    )}
                  </td>
                  <td data-label="状态"><span className={`account-status ${s.enabled ? 'enabled' : 'disabled'}`}>{s.enabled ? '已启用' : '已停用'}</span></td>
                  <td data-label="用户 / 任务">— / —</td>
                  <td data-label="创建时间">{new Date(s.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td data-label="入口链接">
                    {s.entryUrl ? (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <code style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.entryUrl}>…{s.entryUrl.slice(-20)}</code>
                        <a className="icon-button" style={{ width: 30, height: 30 }} href={s.entryUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>
                      </span>
                    ) : '—'}
                  </td>
                  <td data-label="操作">
                    <button className="button compact secondary" onClick={() => setPendingRotate(s.id)}><RotateCcw size={14} />轮换</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog open={pendingRotate !== null} title="确认轮换入口" description="旧入口及已有会话将立即失效。新链接仅展示一次。" confirmLabel="确认轮换" onConfirm={() => void doRotate()} onCancel={() => setPendingRotate(null)} />
      <ToastRegion message={feedback} />
    </>
  )
}
