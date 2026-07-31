import type { ReactNode } from 'react'

export function StatCard({
  label,
  value,
  tone = 'default',
  icon,
}: {
  label: string
  value: number
  tone?: 'default' | 'queued' | 'processing' | 'success' | 'failed'
  icon?: ReactNode
}) {
  return (
    <article className={`stat-card stat-${tone}`}>
      <div className="stat-card-heading">
        <span>{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <strong>{value}</strong>
    </article>
  )
}
