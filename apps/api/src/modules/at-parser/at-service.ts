function base64UrlDecode(segment: string): string {
  const unpadded = segment.replace(/=+$/u, '')
  const padded = unpadded
    .replace(/-/gu, '+')
    .replace(/_/gu, '/')
    .padEnd(Math.ceil(unpadded.length / 4) * 4, '=')
  const binary = Buffer.from(padded, 'base64').toString('binary')
  return Buffer.from(binary, 'binary').toString('utf8')
}

function readPath(obj: unknown, ...keys: string[]): unknown {
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

function firstDefined<T>(...values: (T | undefined | null | '')[]): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v as T
  }
  return undefined
}

// ---------- JWT decode ----------

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

function decodeJwt(token: string): { ok: true; payload: Record<string, unknown>; jwt: JwtInfo } | { ok: false; reason: string; message: string } {
  const normalized = token.trim().replace(/^Bearer\s+/iu, '').trim()
  if (!normalized) return { ok: false, reason: 'empty', message: '请提供 AT token' }

  const parts = normalized.split('.')
  if (parts.length !== 3 || parts.some(p => p.length === 0)) {
    return { ok: false, reason: 'invalid_jwt', message: 'AT 不是有效的三段式 JWT' }
  }

  let payload: Record<string, unknown>
  try { payload = JSON.parse(base64UrlDecode(parts[1])) }
  catch { return { ok: false, reason: 'decode_failed', message: 'JWT payload 解码失败' } }

  const email = firstDefined(readPath(payload, 'https://api.openai.com/profile', 'email'), payload.email) as string | null ?? null
  const plan_type = firstDefined(readPath(payload, 'https://api.openai.com/auth', 'chatgpt_plan_type'), payload.chatgpt_plan_type) as string | null ?? null
  const user_id = firstDefined(readPath(payload, 'https://api.openai.com/auth', 'chatgpt_user_id'), readPath(payload, 'https://api.openai.com/auth', 'user_id'), payload.chatgpt_user_id, payload.user_id) as string | null ?? null
  const account_id = firstDefined(readPath(payload, 'https://api.openai.com/auth', 'chatgpt_account_id'), payload.chatgpt_account_id) as string | null ?? null

  const exp = Number(payload.exp)
  const iat = Number(payload.iat)
  const now = Date.now()
  let expires_at: string | null = null, issued_at: string | null = null, is_expired = false, days_left: number | null = null, hours_left: number | null = null

  if (Number.isFinite(exp) && exp > 0) {
    const expMs = exp > 1_000_000_000_000 ? exp : exp * 1000
    expires_at = new Date(expMs).toISOString()
    const diff = expMs - now
    is_expired = diff <= 0
    days_left = is_expired ? 0 : Math.ceil(diff / 86_400_000)
    hours_left = is_expired ? 0 : Math.ceil(diff / 3_600_000)
  }
  if (Number.isFinite(iat) && iat > 0) {
    const iatMs = iat > 1_000_000_000_000 ? iat : iat * 1000
    issued_at = new Date(iatMs).toISOString()
  }

  return { ok: true, payload, jwt: { email, plan_type, user_id, account_id, issued_at, expires_at, is_expired, days_left, hours_left } }
}

// ---------- upstream subscription query ----------

const ORIGIN = 'https://chatgpt.com'
const HEADERS: Record<string, string> = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'origin': ORIGIN,
  'referer': `${ORIGIN}/`,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
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

async function queryChatGptApi(token: string): Promise<{ accounts: Record<string, unknown>; subscription: Record<string, unknown> } | null> {
  try {
    const accountsRes = await fetch(`${ORIGIN}/backend-api/accounts/check/v4-2023-04-27`, {
      method: 'GET',
      headers: { ...HEADERS, authorization: `Bearer ${token}` },
    })
    if (!accountsRes.ok) return null

    const accountsData = await accountsRes.json() as Record<string, unknown>
    const accounts: Record<string, unknown> = accountsData?.accounts as Record<string, unknown> ?? {}
    const accountRecord = (accounts?.default ?? Object.values(accounts).find(v => typeof v === 'object' && v !== null) ?? {}) as Record<string, unknown>
    const account = (accountRecord?.account ?? {}) as Record<string, unknown>
    const accountId = firstDefined(account?.account_id, account?.id, accountRecord?.account_id) as string | null ?? null

    let subscriptionData: Record<string, unknown> = {}
    if (accountId) {
      try {
        const subRes = await fetch(`${ORIGIN}/backend-api/subscriptions?account_id=${encodeURIComponent(String(accountId))}`, {
          method: 'GET',
          headers: { ...HEADERS, authorization: `Bearer ${token}` },
        })
        if (subRes.ok) subscriptionData = await subRes.json() as Record<string, unknown>
      } catch { /* continue without subscription data */ }
    }

    return { accounts: accountsData, subscription: subscriptionData }
  } catch {
    return null
  }
}

export async function checkAt(token: string): Promise<AtCheckResult> {
  const decoded = decodeJwt(token)
  if (!decoded.ok) {
    return { ok: false, jwt: null, subscription: null, error: decoded.message }
  }

  const jwt = decoded.jwt
  let subscription: SubscriptionInfo | null = null

  const upstream = await queryChatGptApi(token)
  if (upstream) {
    const accounts: Record<string, unknown> = upstream.accounts?.accounts as Record<string, unknown> ?? {}
    const accountRecord = (accounts?.default ?? Object.values(accounts).find(v => typeof v === 'object' && v !== null) ?? {}) as Record<string, unknown>
    const account = (accountRecord?.account ?? {}) as Record<string, unknown>
    const entitlement = (accountRecord?.entitlement ?? {}) as Record<string, unknown>
    const lastActiveSub = (accountRecord?.last_active_subscription ?? {}) as Record<string, unknown>
    const sub = upstream.subscription

    const planType = firstDefined(sub?.plan_type, account?.plan_type, jwt.plan_type) as string | null ?? null
    const expiresAtRaw = firstDefined(sub?.active_until, sub?.expires_at, entitlement?.expires_at)

    let expires_at: string | null = null, days_left: number | null = null, hours_left: number | null = null
    if (expiresAtRaw !== undefined && expiresAtRaw !== null && expiresAtRaw !== '') {
      const expMs = typeof expiresAtRaw === 'number' ? (expiresAtRaw > 1_000_000_000_000 ? expiresAtRaw : expiresAtRaw * 1000) : new Date(String(expiresAtRaw)).getTime()
      if (Number.isFinite(expMs)) {
        expires_at = new Date(expMs).toISOString()
        const diff = expMs - Date.now()
        days_left = diff <= 0 ? 0 : Math.ceil(diff / 86_400_000)
        hours_left = diff <= 0 ? 0 : Math.ceil(diff / 3_600_000)
      }
    }

    subscription = {
      plan_type: planType,
      subscription_plan: firstDefined(entitlement?.subscription_plan, sub?.subscription_plan, sub?.plan) as string | null ?? null,
      subscription_id: firstDefined(entitlement?.subscription_id, sub?.subscription_id, sub?.id) as string | null ?? null,
      has_active_subscription: Boolean(firstDefined(entitlement?.has_active_subscription, sub?.has_active_subscription, sub?.is_active, false)),
      billing_period: firstDefined(entitlement?.billing_period, sub?.billing_period) as string | null ?? null,
      billing_currency: firstDefined(entitlement?.billing_currency, sub?.billing_currency) as string | null ?? null,
      expires_at, days_left, hours_left,
      will_renew: Boolean(firstDefined(lastActiveSub?.will_renew, sub?.will_renew, false)),
      is_gratis: Boolean(firstDefined(sub?.is_gratis, entitlement?.is_gratis, false)),
      purchase_origin_platform: firstDefined(sub?.purchase_origin_platform, lastActiveSub?.purchase_origin_platform) as string | null ?? null,
    }
  }

  return { ok: true, jwt, subscription }
}
