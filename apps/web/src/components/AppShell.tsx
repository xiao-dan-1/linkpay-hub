import type { PropsWithChildren, ReactNode } from 'react'

export function AppShell({
  title,
  subtitle,
  eyebrow = 'TASK WORKBENCH',
  actions,
  children,
}: PropsWithChildren<{
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
}>) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-copy">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle ? <p className="header-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="header-actions">{actions}</div> : null}
      </header>
      {children}
    </div>
  )
}
