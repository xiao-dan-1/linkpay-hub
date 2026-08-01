/**
 * Decode a JWT payload locally (no signature verification).
 * Returns null if the token is not a valid JWT.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const normalized = token.trim().replace(/^Bearer\s+/iu, '')
    const parts = normalized.split('.')
    if (parts.length !== 3 || parts.some(p => p.length === 0)) return null

    // base64url decode the payload (second segment)
    const unpadded = parts[1].replace(/=+$/u, '')
    const padded = unpadded
      .replace(/-/gu, '+')
      .replace(/_/gu, '/')
      .padEnd(Math.ceil(unpadded.length / 4) * 4, '=')

    const json = atob(padded)
    const decoded = new TextDecoder().decode(
      Uint8Array.from(json, c => c.charCodeAt(0)),
    )
    const parsed = JSON.parse(decoded)
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function readPath(obj: unknown, ...keys: string[]): unknown {
  let current = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export interface JwtAccountInfo {
  email: string | null
  planType: string | null
  isExpired: boolean
}

export function extractAccountInfo(at: string): JwtAccountInfo {
  const payload = decodeJwtPayload(at)
  if (!payload) return { email: null, planType: null, isExpired: false }

  const email = (readPath(payload, 'https://api.openai.com/profile', 'email')
    ?? payload.email) as string | null ?? null

  const planType = (readPath(payload, 'https://api.openai.com/auth', 'chatgpt_plan_type')
    ?? payload.chatgpt_plan_type) as string | null ?? null

  const exp = Number(payload.exp)
  let isExpired = false
  if (Number.isFinite(exp) && exp > 0) {
    const expMs = exp > 1_000_000_000_000 ? exp : exp * 1000
    isExpired = expMs <= Date.now()
  }

  return { email, planType, isExpired }
}
