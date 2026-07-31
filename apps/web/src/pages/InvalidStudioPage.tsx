import { Link2Off } from 'lucide-react'
import { Link } from 'react-router-dom'

export function InvalidStudioPage() {
  return (
    <main className="state-page">
      <div className="state-icon"><Link2Off size={30} /></div>
      <p className="eyebrow">LINK UNAVAILABLE</p>
      <h1>入口已失效</h1>
      <p>该工作室入口不存在或已停用，请向管理员获取新的专属链接。</p>
      <Link className="button" to="/login">返回用户登录</Link>
    </main>
  )
}
