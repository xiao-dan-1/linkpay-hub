import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminGuard, UserGuard } from '../auth/RouteGuards'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { InvalidStudioPage } from '../pages/InvalidStudioPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { UserLoginPage } from '../pages/user/UserLoginPage'
import { UserWorkbenchPage } from '../pages/user/UserWorkbenchPage'
import { StudioPage } from '../pages/studio/StudioPage'
import { AdminLayout } from '../pages/admin/AdminLayout'
import { AdminDashboard } from '../pages/admin/AdminDashboard'
import { AdminTasksPage } from '../pages/admin/AdminTasksPage'
import { AdminUsersPage } from '../pages/admin/AdminUsersPage'
import { AdminStudioPage } from '../pages/admin/AdminStudioPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<UserLoginPage />} />
      <Route element={<UserGuard />}>
        <Route path="/user/workbench" element={<UserWorkbenchPage />} />
      </Route>
      <Route path="/studio/:accessToken" element={<StudioPage />} />
      <Route path="/studio/workbench" element={<StudioPage />} />
      <Route path="/studio/invalid" element={<InvalidStudioPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="tasks" element={<AdminTasksPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="studio" element={<AdminStudioPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
