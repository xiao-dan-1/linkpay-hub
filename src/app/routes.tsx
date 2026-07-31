import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AdminGuard, UserGuard } from '../auth/RouteGuards'
import { AdminLoginPage } from '../pages/admin/AdminLoginPage'
import { InvalidStudioPage } from '../pages/InvalidStudioPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { UserLoginPage } from '../pages/user/UserLoginPage'
import { UserRegisterPage } from '../pages/user/UserRegisterPage'
import { UserWorkbenchPage } from '../pages/user/UserWorkbenchPage'
import { StudioPage } from '../pages/studio/StudioPage'

function Placeholder({ title }: { title: string }) {
  return <main className="app-shell"><h1>{title}</h1></main>
}

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<UserLoginPage />} />
      <Route path="/s/:registrationCode/register" element={<UserRegisterPage />} />
      <Route element={<UserGuard />}>
        <Route path="/user/workbench" element={<UserWorkbenchPage />} />
      </Route>
      <Route path="/studio/:accessToken" element={<StudioPage />} />
      <Route path="/studio/invalid" element={<InvalidStudioPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<AdminGuard />}>
        <Route path="/admin" element={<Outlet />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Placeholder title="管理员概览" />} />
          <Route path="tasks" element={<Placeholder title="全部任务" />} />
          <Route path="users" element={<Placeholder title="用户管理" />} />
          <Route path="studio" element={<Placeholder title="工作室设置" />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
