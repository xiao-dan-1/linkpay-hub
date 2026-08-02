import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CHATGPT_SESSION_URL = 'https://chatgpt.com/api/auth/session'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

export interface RefreshAccessTokenResult {
  ok: boolean
  accessToken?: string
  error?: string
}

export async function refreshAccessTokenFromCookie(
  cookieSessionToken: string,
): Promise<RefreshAccessTokenResult> {
  try {
    const { stdout } = await execFileAsync('curl', [
      '-sS',
      CHATGPT_SESSION_URL,
      '-H', `User-Agent: ${UA}`,
      '-H', 'Accept: application/json',
      '-H', `Cookie: __Secure-next-auth.session-token=${cookieSessionToken}`,
      '--max-time', '15',
    ], {
      timeout: 16000,
      maxBuffer: 1024 * 1024,
    })

    const data = JSON.parse(stdout) as { accessToken?: string; sessionToken?: string }
    if (!data.accessToken) {
      return { ok: false, error: '响应中未包含 accessToken，session-token 可能已过期' }
    }

    return { ok: true, accessToken: data.accessToken }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '未知错误'
    // Try to extract HTTP status from curl error
    const httpMatch = message.match(/HTTP (\d+)/)
    if (httpMatch) {
      return { ok: false, error: `ChatGPT 返回 HTTP ${httpMatch[1]}` }
    }
    return { ok: false, error: `请求失败: ${message}` }
  }
}
