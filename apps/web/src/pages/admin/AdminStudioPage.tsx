import { Building2, Check, Copy, ExternalLink, KeyRound, Link2, Plus, RotateCcw, Save, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createStudio, getDashboard, getStudio, listStudios, rotateAccess, updateStudio } from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import type { Studio } from '../../domain/models'

export function AdminStudioPage() {
  const [studios, setStudios] = useState<Studio[]>([])
  const [studio, setStudio] = useState<Studio | null>(null)
  const [name, setName] = useState('')
  const [newName, setNewName] = useState('')
  const [userCount, setUserCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [studioLink, setStudioLink] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pendingRotation, setPendingRotation] = useState(false)
  const [creating, setCreating] = useState(false)

  const load = async () => {
    try {
      const [current, all, dashboard] = await Promise.all([getStudio(), listStudios(), getDashboard()])
      setStudio(current)
      setStudios(all)
      setName(current.name)
      setStudioLink(current.entryUrl ?? '')
      setUserCount(dashboard.users)
      setTaskCount(dashboard.tasks)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '工作室信息加载失败')
    }
  }

  useEffect(() => { void load() }, [])

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setFeedback('工作室名称不能为空'); return }
    try {
      const updated = await updateStudio(trimmed)
      setStudio(updated)
      setName(updated.name)
      setStudios(s => s.map(st => st.id === updated.id ? updated : st))
      setFeedback('工作室名称已保存')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '保存失败')
    }
  }

  const addStudio = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    setCreating(true)
    try {
      const result = await createStudio(trimmed)
      setStudios(s => [...s, result.studio])
      setNewName('')
      copyToClipboard(`${window.location.origin}/studio/${result.accessToken}`)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '创建失败')
    } finally { setCreating(false) }
  }

  const rotate = async () => {
    if (!pendingRotation) return
    try {
      setStudioLink(await rotateAccess())
      setFeedback('已生成新的工作室入口，旧入口会话已失效')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '入口轮换失败')
    } finally { setPendingRotation(false) }
  }

  const copyToClipboard = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setFeedback('已复制到剪贴板') }
    catch { setFeedback('复制失败，请手动复制') }
  }

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">STUDIO SETTINGS</p><h1>工作室设置</h1><p>管理工作室名称和工作室专属入口。</p></div><span className="identity-chip"><Check size={15} />{studio?.enabled ? '已启用' : '加载中'}</span></header>

      {/* 新增工作室 */}
      <section className="panel settings-card" style={{ marginBottom: 16 }}>
        <div className="settings-card-heading"><span className="settings-icon"><Plus size={21} /></span><div><h2>新增工作室</h2><p>输入名称创建新工作室，入口链接会自动复制到剪贴板。</p></div></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ flex: 1, minHeight: 44, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 10, outline: 0, fontSize: 14 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="新工作室名称" onKeyDown={e => { if (e.key === 'Enter') void addStudio() }} />
          <button className="button" disabled={creating || !newName.trim()} onClick={() => void addStudio()}><Plus size={17} />{creating ? '创建中…' : '创建'}</button>
        </div>
      </section>

      <section className="studio-settings-grid">
        <article className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Building2 size={21} /></span><div><h2>基本信息</h2><p>修改当前工作室名称。</p></div></div><label className="settings-field"><span>工作室名称</span><input aria-label="工作室名称" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button" onClick={() => void saveName()}><Save size={17} />保存名称</button><div className="studio-metrics"><div><Users size={18} /><span>用户密钥</span><strong>{userCount}</strong></div><div><Link2 size={18} /><span>任务总数</span><strong>{taskCount}</strong></div></div></article>
        <article className="panel settings-card links-card"><div className="settings-card-heading"><span className="settings-icon"><KeyRound size={21} /></span><div><h2>工作室入口</h2><p>显示当前入口链接；轮换后新链接只展示一次。</p></div></div><div className="link-setting"><label htmlFor="studio-link">工作室工作台链接</label><div><input id="studio-link" readOnly value={studioLink} placeholder="暂无回显链接" /><a className="icon-button" href={studioLink || '#'} target="_blank" rel="noreferrer" style={{ opacity: studioLink ? 1 : 0.4, pointerEvents: studioLink ? 'auto' : 'none' }}><ExternalLink size={17} /></a></div><button className="button secondary compact" onClick={() => setPendingRotation(true)}><RotateCcw size={16} />轮换工作室入口</button></div></article>
      </section>

      {/* 工作室列表 */}
      {studios.length > 0 ? (
        <section className="panel settings-card" style={{ marginTop: 16 }}>
          <div className="settings-card-heading"><span className="settings-icon"><Building2 size={21} /></span><div><h2>所有工作室 ({studios.length})</h2><p>系统中已创建的工作室。</p></div></div>
          <div className="user-table-wrap">
            <table className="user-table"><thead><tr><th>名称</th><th>状态</th><th>创建时间</th><th>入口</th></tr></thead>
              <tbody>{studios.map(s => (
                <tr key={s.id}>
                  <td>{s.id === studio?.id ? <strong>{s.name} (当前)</strong> : s.name}</td>
                  <td><span className={`account-status ${s.enabled ? 'enabled' : 'disabled'}`}>{s.enabled ? '已启用' : '已停用'}</span></td>
                  <td>{new Date(s.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td>{s.entryUrl ? <a href={s.entryUrl} target="_blank" rel="noreferrer" className="text-link">前往</a> : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      ) : null}

      <ConfirmDialog open={pendingRotation} title="确认轮换工作室入口" description="旧工作室入口及已有工作室会话将失效。新链接只展示一次。" confirmLabel="确认轮换" onConfirm={() => void rotate()} onCancel={() => setPendingRotation(false)} />
      <ToastRegion message={feedback} />
    </>
  )
}
