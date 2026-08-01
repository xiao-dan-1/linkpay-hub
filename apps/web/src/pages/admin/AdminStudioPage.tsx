import { Building2, Check, Copy, KeyRound, Link2, RotateCcw, Save, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  getDashboard,
  getStudio,
  rotateAccess,
  updateStudio,
} from '../../api/admin'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import type { Studio } from '../../domain/models'

export function AdminStudioPage() {
  const [studio, setStudio] = useState<Studio | null>(null)
  const [name, setName] = useState('')
  const [userCount, setUserCount] = useState(0)
  const [taskCount, setTaskCount] = useState(0)
  const [studioLink, setStudioLink] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pendingRotation, setPendingRotation] = useState(false)

  useEffect(() => {
    Promise.all([getStudio(), getDashboard()])
      .then(([current, dashboard]) => {
        setStudio(current)
        setName(current.name)
        setUserCount(dashboard.users)
        setTaskCount(dashboard.tasks)
      })
      .catch((cause) => setFeedback(cause instanceof Error ? cause.message : '工作室信息加载失败'))
  }, [])

  const saveName = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setFeedback('工作室名称不能为空'); return }
    try {
      const updated = await updateStudio(trimmed)
      setStudio(updated)
      setName(updated.name)
      setFeedback('工作室名称已保存')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '保存失败')
    }
  }

  const rotate = async () => {
    if (!pendingRotation) return
    try {
      setStudioLink(await rotateAccess())
      setFeedback('已生成新的工作室入口，旧入口会话已失效')
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : '入口轮换失败')
    } finally {
      setPendingRotation(false)
    }
  }

  const copyLink = async (value: string, label: string) => {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setFeedback(`${label}已复制`) }
    catch { setFeedback(`${label}复制失败，请手动复制`) }
  }

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">STUDIO SETTINGS</p><h1>工作室设置</h1><p>维护唯一工作室名称和工作室专属入口。</p></div><span className="identity-chip"><Check size={15} />{studio?.enabled ? '已启用' : '加载中'}</span></header>
      <section className="studio-settings-grid">
        <article className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Building2 size={21} /></span><div><h2>基本信息</h2><p>当前正式环境配置一个工作室。</p></div></div><label className="settings-field"><span>工作室名称</span><input aria-label="工作室名称" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button" onClick={() => void saveName()}><Save size={17} />保存名称</button><div className="studio-metrics"><div><Users size={18} /><span>用户密钥</span><strong>{userCount}</strong></div><div><Link2 size={18} /><span>任务总数</span><strong>{taskCount}</strong></div></div></article>
        <article className="panel settings-card links-card"><div className="settings-card-heading"><span className="settings-icon"><KeyRound size={21} /></span><div><h2>工作室入口</h2><p>入口令牌不会回显，轮换后的新链接只展示一次。</p></div></div><div className="link-setting"><label htmlFor="studio-link">新工作室工作台链接</label><div><input id="studio-link" readOnly value={studioLink} placeholder="点击轮换后显示一次" /><button className="icon-button" disabled={!studioLink} aria-label="复制工作室工作台链接" onClick={() => void copyLink(studioLink, '工作室工作台链接')}><Copy size={17} /></button></div><button className="button secondary compact" onClick={() => setPendingRotation(true)}><RotateCcw size={16} />轮换工作室入口</button></div></article>
      </section>
      <ConfirmDialog open={pendingRotation} title="确认轮换工作室入口" description="旧工作室入口及已有工作室会话将失效。新链接只展示一次。" confirmLabel="确认轮换" onConfirm={() => void rotate()} onCancel={() => setPendingRotation(false)} />
      <ToastRegion message={feedback} />
    </>
  )
}
