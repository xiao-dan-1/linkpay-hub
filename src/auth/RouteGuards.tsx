import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function UserGuard() {
  const { user } = useAuth()
  const location = useLocation()

  return user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  )
}

export function AdminGuard() {
  const { admin } = useAuth()

  return admin ? <Outlet /> : <Navigate to="/admin/login" replace />
}
