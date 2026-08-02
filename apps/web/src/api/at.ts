import { apiRequest } from './client'

export interface JwtInfo {
  email: string | null
  plan_type: string | null
  user_id: string | null
  account_id: string | null
  issued_at: string | null
  expires_at: string | null
  is_expired: boolean
  days_left: number | null
  hours_left: number | null
}

export interface SubscriptionInfo {
  plan_type: string | null
  subscription_plan: string | null
  subscription_id: string | null
  has_active_subscription: boolean
  billing_period: string | null
  billing_currency: string | null
  expires_at: string | null
  days_left: number | null
  hours_left: number | null
  will_renew: boolean
  is_gratis: boolean
  purchase_origin_platform: string | null
}

export interface AtCheckResult {
  ok: boolean
  jwt: JwtInfo | null
  subscription: SubscriptionInfo | null
  error?: string
}

export async function checkAt(at: string): Promise<AtCheckResult> {
  return apiRequest('/api/v1/user/at/check', {
    method: 'POST',
    body: { at },
  })
}

export async function generatePayLink(at: string): Promise<{ ok: boolean; pay_url?: string; error?: string }> {
  return apiRequest('/api/v1/user/at/generate-pay-link', {
    method: 'POST',
    body: { at },
  })
}

export async function refreshAccessToken(cookieAt: string): Promise<{ ok: boolean; accessToken?: string; error?: string }> {
  return apiRequest('/api/v1/user/at/refresh', {
    method: 'POST',
    body: { cookieAt },
  })
}
