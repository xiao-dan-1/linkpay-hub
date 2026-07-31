import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { Admin, User } from '../domain/models'
import { useData } from '../data/DataContext'
import { sessionStore } from './session'

type AuthValue = {
  user?: User
  admin?: Admin
  loginUser: (username: string, password: string) => void
  logoutUser: () => void
  loginAdmin: (username: string, password: string) => void
  logoutAdmin: () => void
  setRegisteredUser: (user: User) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const { repository, version } = useData()
  const [userId, setUserId] = useState(sessionStore.getUserId)
  const [adminId, setAdminId] = useState(sessionStore.getAdminId)
  const state = repository.getState()
  const user = state.users.find((item) => item.id === userId && item.enabled)
  const admin = state.admins.find((item) => item.id === adminId)

  const value = useMemo<AuthValue>(
    () => ({
      user,
      admin,
      loginUser(username, password) {
        const matched = repository.authenticateUser(username, password)
        if (!matched) {
          throw new Error('账号、密码错误或账号已停用')
        }
        sessionStore.setUserId(matched.id)
        setUserId(matched.id)
      },
      logoutUser() {
        sessionStore.setUserId(null)
        setUserId(null)
      },
      loginAdmin(username, password) {
        const matched = repository.authenticateAdmin(username, password)
        if (!matched) {
          throw new Error('管理员账号或密码错误')
        }
        sessionStore.setAdminId(matched.id)
        setAdminId(matched.id)
      },
      logoutAdmin() {
        sessionStore.setAdminId(null)
        setAdminId(null)
      },
      setRegisteredUser(registered) {
        sessionStore.setUserId(registered.id)
        setUserId(registered.id)
      },
    }),
    [admin, repository, user, version],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
