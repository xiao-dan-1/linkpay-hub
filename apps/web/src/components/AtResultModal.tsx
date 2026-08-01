import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { AtCheckResult } from '../api/at'

type AtResultData = { title: string; result: AtCheckResult }

function dash(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

function planLabel(p: string): string {
  const map: Record<string, string> = {
    free: 'Free', chatgptfreeplan: 'Free', plus: 'Plus', chatgptplusplan: 'Plus',
    pro: 'Pro', chatgptproplan: 'Pro', chatgptprolite: 'Pro Lite',
    chatgptgoplan: 'Go', chatgptteamplan: 'Team', chatgptfreeworkspaceplan: 'Free Workspace',
  }
  return map[p] ?? p
}

export function AtResultModal({ data, onClose }: { data: AtResultData | null; onClose: () => void }) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!data) return
    const l = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    document.addEventListener('keydown', l)
    return () => document.removeEventListener('keydown', l)
  }, [data?.title])

  if (!data) return null

  const { result } = data
  const j = result.jwt
  const s = result.subscription
  const planType = s?.plan_type || j?.plan_type || 'unknown'
  const hasActive = s?.has_active_subscription || false

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal at-detail-modal" role="dialog" aria-modal="true" aria-labelledby="at-result-title">
        {/* header */}
        <div className="at-detail-header">
          <div>
            <span className="at-plan-title">{planLabel(planType)}</span>
            <span className={`at-status-tag${hasActive ? ' at-status-active' : ''}`}>
              {hasActive ? '活跃订阅' : '无活跃订阅'}
            </span>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={onClose}><X size={20} /></button>
        </div>

        {/* account info */}
        {j?.email ? <div className="at-detail-email">{j.email}</div> : null}
        {j?.account_id ? <div className="at-detail-uuid">{j.account_id}</div> : null}

        {result.error ? <p className="form-error">{result.error}</p> : null}

        {/* stat cards row 1 */}
        <div className="at-stat-grid">
          <div className="at-stat-item">
            <span className="at-stat-label">剩余时间</span>
            <span className="at-stat-value">
              {s?.days_left != null ? `${s.days_left} 天` : j?.days_left != null ? `${j.days_left} 天` : '—'}
            </span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">套餐 ID</span>
            <span className="at-stat-value">{dash(s?.subscription_plan || s?.plan_type)}</span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">续费</span>
            <span className="at-stat-value">{s ? (s.will_renew ? '是' : '否') : '—'}</span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">渠道</span>
            <span className="at-stat-value">{dash(s?.purchase_origin_platform)}</span>
          </div>
        </div>

        {/* stat cards row 2 */}
        <div className="at-stat-grid">
          <div className="at-stat-item">
            <span className="at-stat-label">订阅开始</span>
            <span className="at-stat-value">—</span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">订阅结束</span>
            <span className="at-stat-value">{s?.expires_at ? new Date(s.expires_at).toLocaleDateString('zh-CN') : '—'}</span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">曾付费</span>
            <span className="at-stat-value">{s?.is_gratis ? '否' : s ? '是' : '—'}</span>
          </div>
          <div className="at-stat-item">
            <span className="at-stat-label">AT 有效期</span>
            <span className="at-stat-value">
              {j?.days_left != null ? `${j.days_left} 天` : j?.expires_at ? new Date(j.expires_at).toLocaleDateString('zh-CN') : '—'}
            </span>
          </div>
        </div>

        {/* JWT info summary */}
        {j ? (
          <div className="at-stat-grid" style={{ marginTop: 12 }}>
            <div className="at-stat-item">
              <span className="at-stat-label">签发时间</span>
              <span className="at-stat-value">{j.issued_at ? new Date(j.issued_at).toLocaleString('zh-CN') : '—'}</span>
            </div>
            <div className="at-stat-item">
              <span className="at-stat-label">过期时间</span>
              <span className="at-stat-value" style={{ color: j.is_expired ? 'var(--failed)' : undefined }}>
                {j.expires_at ? new Date(j.expires_at).toLocaleString('zh-CN') : '—'}
              </span>
            </div>
            <div className="at-stat-item">
              <span className="at-stat-label">Token 状态</span>
              <span className="at-stat-value">{j.is_expired ? '已过期' : '有效'}</span>
            </div>
            <div className="at-stat-item">
              <span className="at-stat-label">用户 ID</span>
              <span className="at-stat-value" style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dash(j.user_id)}</span>
            </div>
          </div>
        ) : null}

        {/* subscription fetch note */}
        {result.ok && !result.subscription ? (
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>订阅查询未返回（上游可能不可达），以上为 JWT 解析数据。</p>
        ) : null}
      </div>
    </div>
  )
}
