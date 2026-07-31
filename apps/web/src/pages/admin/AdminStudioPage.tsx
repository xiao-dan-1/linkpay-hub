import { Building2, Check, Copy, Link2, RotateCcw, Save, Users } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ToastRegion } from '../../components/ToastRegion'
import { sessionStore } from '../../auth/session'
import { useData } from '../../data/DataContext'

export function AdminStudioPage() {
  const { repository, refresh } = useData()
  const state = repository.getState()
  const studio = state.studios[0]
  const [name, setName] = useState(studio?.name ?? '')
  const [feedback, setFeedback] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)

  if (!studio) return null

  const registrationLink = `${window.location.origin}/s/${studio.registrationCode}/register`
  const studioLink = `${window.location.origin}/studio/${studio.accessToken}`
  const userCount = state.users.filter((user) => user.studioId === studio.id).length
  const taskCount = state.tasks.filter((task) => task.studioId === studio.id).length

  const saveName = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setFeedback('工作室名称不能为空')
      return
    }
    repository.updateStudioName(studio.id, trimmed)
    refresh()
    setName(trimmed)
    setFeedback('工作室名称已保存')
  }

  const copyLink = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setFeedback(`${label}已复制`)
    } catch {
      setFeedback(`${label}复制失败，请手动复制`)
    }
  }

  const reset = () => {
    const resetState = repository.reset()
    sessionStore.setUserId(null)
    refresh()
    setName(resetState.studios[0].name)
    setConfirmReset(false)
    setFeedback('演示数据已重置')
  }

  return (
    <>
      <header className="admin-page-header"><div><p className="eyebrow">STUDIO SETTINGS</p><h1>工作室设置</h1><p>维护唯一工作室名称和两个专属入口。</p></div><span className="identity-chip"><Check size={15} />已启用</span></header>
      <section className="studio-settings-grid">
        <article className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Building2 size={21} /></span><div><h2>基本信息</h2><p>当前原型只配置一个工作室。</p></div></div><label className="settings-field"><span>工作室名称</span><input aria-label="工作室名称" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button" onClick={saveName}><Save size={17} />保存名称</button><div className="studio-metrics"><div><Users size={18} /><span>绑定用户</span><strong>{userCount}</strong></div><div><Link2 size={18} /><span>任务总数</span><strong>{taskCount}</strong></div></div></article>
        <article className="panel settings-card links-card"><div className="settings-card-heading"><span className="settings-icon"><Link2 size={21} /></span><div><h2>专属入口</h2><p>复制链接后发送给对应访问者。</p></div></div><div className="link-setting"><label htmlFor="registration-link">用户注册链接</label><div><input id="registration-link" readOnly value={registrationLink} /><button className="icon-button" aria-label="复制用户注册链接" onClick={() => copyLink(registrationLink, '用户注册链接')}><Copy size={17} /></button></div></div><div className="link-setting"><label htmlFor="studio-link">工作室工作台链接</label><div><input id="studio-link" readOnly value={studioLink} /><button className="icon-button" aria-label="复制工作室工作台链接" onClick={() => copyLink(studioLink, '工作室工作台链接')}><Copy size={17} /></button></div></div></article>
      </section>
      <section className="panel danger-zone"><div><p className="eyebrow">DEMO DATA</p><h2>重置演示数据</h2><p>恢复内置管理员、演示用户、工作室和四种状态的初始任务。</p></div><button className="button danger" onClick={() => setConfirmReset(true)}><RotateCcw size={17} />重置演示数据</button></section>
      <ConfirmDialog open={confirmReset} title="确认重置演示数据" description="当前用户、任务和工作室修改会被初始演示数据替换。管理员登录状态将保留。" confirmLabel="确认重置" onConfirm={reset} onCancel={() => setConfirmReset(false)} />
      <ToastRegion message={feedback} />
    </>
  )
}
