type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown
}

let csrfToken: string | null = null
let csrfPromise: Promise<string> | null = null

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function responseBody(response: Response) {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') ?? ''
  return contentType.includes('application/json')
    ? response.json()
    : response.text()
}

async function fetchCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfPromise) {
    csrfPromise = fetch('/api/v1/csrf', { credentials: 'include' })
      .then(async (response) => {
        const body = await responseBody(response) as { token?: string }
        if (!response.ok || !body?.token) {
          throw new ApiError(response.status, 'CSRF_UNAVAILABLE', '安全令牌获取失败')
        }
        csrfToken = body.token
        return body.token
      })
      .finally(() => { csrfPromise = null })
  }
  return csrfPromise
}

export function resetCsrfToken() {
  csrfToken = null
  csrfPromise = null
}

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers.set('x-csrf-token', await fetchCsrfToken())
  }
  const response = await fetch(path, {
    ...options,
    method,
    credentials: 'include',
    headers: Object.fromEntries(headers.entries()),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const body = await responseBody(response)
  if (!response.ok) {
    const error = body as {
      error?: {
        code?: string
        message?: string
        requestId?: string
        fields?: Record<string, string>
      }
    }
    if (response.status === 403 && error.error?.code?.includes('CSRF')) {
      resetCsrfToken()
    }
    throw new ApiError(
      response.status,
      error.error?.code ?? 'REQUEST_FAILED',
      error.error?.message ?? '请求失败',
      error.error?.requestId,
      error.error?.fields,
    )
  }
  return body as T
}

