import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function UserGuard() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="route-loading">正在验证登录状态…</div>

  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}

export function AdminGuard() {
  const { admin, loading } = useAuth()

  if (loading) return <div className="route-loading">正在验证管理员状态…</div>

  return admin ? <Outlet /> : <Navigate to="/admin/login" replace />
}
