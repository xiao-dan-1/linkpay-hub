import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  tone = 'default',
  icon,
  active = false,
  onClick,
}: {
  label: string
  value: number
  tone?: 'default' | 'queued' | 'processing' | 'success' | 'failed'
  icon?: ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <article
      className={`stat-card stat-${tone}${active ? ' stat-card-active' : ''}${onClick ? ' stat-card-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="stat-card-heading">
        <span>{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
    </article>
  )
}
