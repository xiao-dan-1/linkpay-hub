import type { PropsWithChildren } from 'react'
import { AuthProvider } from '../auth/AuthContext'
import { DataProvider } from '../data/DataContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <DataProvider>
      <AuthProvider>{children}</AuthProvider>
    </DataProvider>
  )
}
