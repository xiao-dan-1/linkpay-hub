import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="state-page">
      <div className="state-icon"><Compass size={30} /></div>
      <p className="eyebrow">404 NOT FOUND</p>
      <h1>页面不存在</h1>
      <p>当前地址没有对应页面，可以返回用户端或管理员端。</p>
      <div className="inline-actions">
        <Link className="button" to="/login">用户登录</Link>
        <Link className="button ghost" to="/admin/login">管理员登录</Link>
      </div>
    </main>
  )
}
