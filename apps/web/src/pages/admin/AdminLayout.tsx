import {
  Building2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const navigation = [
  { to: '/admin/dashboard', label: '数据概览', icon: LayoutDashboard },
  { to: '/admin/tasks', label: '全部任务', icon: ClipboardList },
  { to: '/admin/users', label: '密钥管理', icon: Users },
  { to: '/admin/studio', label: '工作室设置', icon: Building2 },
]

export function AdminLayout() {
  const { admin, logoutAdmin } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span className="admin-brand-icon"><ShieldCheck size={22} /></span><div><strong>LinkPay Hub</strong><small>管理控制台</small></div></div>
        <nav className="admin-nav" aria-label="管理员导航">
          <a href="/user/workbench" className="admin-nav-external">用户工作台</a>
          {navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="admin-profile"><div><span>当前管理员</span><strong>{admin?.username ?? 'admin'}</strong></div><button className="icon-button" aria-label="退出管理员登录" onClick={() => { void logoutAdmin().then(() => navigate('/admin/login')) }}><LogOut size={18} /></button></div>
      </aside>
      <main className="admin-main"><Outlet /></main>
    </div>
  )
}
