import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, resetCsrfToken } from './client'

describe('API client', () => {
  beforeEach(() => resetCsrfToken())

  it('sends cookies and a CSRF token on writes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'csrf-token-value-that-is-long-enough' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/api/v1/example', { method: 'POST', body: { value: 1 } }))
      .resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/v1/csrf', expect.objectContaining({
      credentials: 'include',
    }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/example', expect.objectContaining({
      credentials: 'include',
      headers: expect.objectContaining({ 'x-csrf-token': 'csrf-token-value-that-is-long-enough' }),
    }))
  })

  it('exposes stable server error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'AUTH_REQUIRED', message: '登录状态已失效', requestId: 'request-1' },
    }), { status: 401, headers: { 'content-type': 'application/json' } })))

    await expect(apiRequest('/api/v1/auth/user/session')).rejects.toMatchObject({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: '登录状态已失效',
    })
  })
})
