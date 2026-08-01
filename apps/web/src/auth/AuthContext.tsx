import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import type { SessionPrincipal } from '@linkpay/contracts'
import * as authApi from '../api/auth'

type UserPrincipal = SessionPrincipal & {
  role: 'user'
  userLabel: string
  studioId: string
}

type AdminPrincipal = SessionPrincipal & {
  role: 'admin'
  username: string
}

type AuthValue = {
  user?: UserPrincipal
  admin?: AdminPrincipal
  loading: boolean
  loginUser: (key: string) => Promise<void>
  logoutUser: () => Promise<void>
  loginAdmin: (username: string, password: string) => Promise<void>
  logoutAdmin: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<UserPrincipal>()
  const [admin, setAdmin] = useState<AdminPrincipal>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.allSettled([authApi.getUserSession(), authApi.getAdminSession()])
      .then(([userResult, adminResult]) => {
        if (!active) return
        if (userResult.status === 'fulfilled' && userResult.value.role === 'user') {
          setUser(userResult.value as UserPrincipal)
        }
        if (adminResult.status === 'fulfilled' && adminResult.value.role === 'admin') {
          setAdmin(adminResult.value as AdminPrincipal)
        }
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      admin,
      loading,
      async loginUser(key) {
        const principal = await authApi.loginUser(key)
        setUser(principal as UserPrincipal)
      },
      async logoutUser() {
        await authApi.logoutUser()
        setUser(undefined)
      },
      async loginAdmin(username, password) {
        const principal = await authApi.loginAdmin(username, password)
        setAdmin(principal as AdminPrincipal)
      },
      async logoutAdmin() {
        await authApi.logoutAdmin()
        setAdmin(undefined)
      },
    }),
    [admin, loading, user],
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
