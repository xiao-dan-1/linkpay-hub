import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const CHATGPT_SESSION_URL = 'https://chatgpt.com/api/auth/session'

export interface RefreshAccessTokenResult {
  ok: boolean
  accessToken?: string
  error?: string
}

export async function refreshAccessTokenFromCookie(
  cookieSessionToken: string,
): Promise<RefreshAccessTokenResult> {
  // Use Python urllib — its TLS fingerprint passes Cloudflare unlike curl/OpenSSL
  const script = `
import json, urllib.request, sys
try:
    req = urllib.request.Request('${CHATGPT_SESSION_URL}', headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Cookie': '__Secure-next-auth.session-token=${cookieSessionToken.replace(/'/g, "'\\''")}',
    })
    resp = urllib.request.urlopen(req, timeout=15)
    body = resp.read().decode()
    data = json.loads(body)
    at = data.get('accessToken')
    if at:
        print(json.dumps({'ok': True, 'accessToken': at}))
    else:
        print(json.dumps({'ok': False, 'error': 'no accessToken in response'}))
except urllib.error.HTTPError as e:
    print(json.dumps({'ok': False, 'error': f'ChatGPT HTTP {e.code}'}))
except Exception as e:
    print(json.dumps({'ok': False, 'error': str(e)[:200]}))
`

  try {
    const { stdout } = await execFileAsync('python3', ['-c', script], {
      timeout: 20000,
      maxBuffer: 1024 * 1024,
    })

    const result = JSON.parse(stdout) as RefreshAccessTokenResult
    return result
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '未知错误'
    return { ok: false, error: `请求失败: ${message}` }
  }
}
