import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import { hashPassword } from '../src/lib/passwords.js'
import { hashToken } from '../src/lib/tokens.js'

const origin = 'http://127.0.0.1:5173'

function cookiesFrom(response: { headers: Record<string, unknown> }) {
  const header = response.headers['set-cookie']
  const values = Array.isArray(header) ? header : header ? [header] : []
  return values.map((value) => String(value).split(';')[0]).join('; ')
}

describe('production end-to-end flow', () => {
  let app: FastifyInstance
  let csrfCookie: string
  let csrfToken: string

  beforeAll(async () => { app = await buildApp({ logger: false }) })
  afterAll(async () => { await app.close() })

  beforeEach(async () => {
    await prisma.submissionChunk.deleteMany()
    await prisma.submissionBatch.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.session.deleteMany()
    await prisma.task.deleteMany()
    await prisma.user.deleteMany()
    await prisma.admin.deleteMany()
    await prisma.studio.deleteMany()
    await prisma.studio.create({ data: {
      name: '正式工作室',
      accessTokenHash: hashToken('studio-access-token'),
    } })
    await prisma.admin.create({ data: {
      username: 'root',
      normalizedUsername: 'root',
      passwordHash: await hashPassword('admin-password'),
    } })
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/csrf' })
    csrfCookie = cookiesFrom(csrf)
    csrfToken = csrf.json().token
  })

  function writeHeaders(cookie = '') {
    return {
      origin,
      cookie: [cookie, csrfCookie].filter(Boolean).join('; '),
      'x-csrf-token': csrfToken,
    }
  }

  it('moves tasks through user, studio, and administrator workflows', async () => {
    const adminLogin = await app.inject({
      method: 'POST', url: '/api/v1/auth/admin/login', headers: writeHeaders(),
      payload: { username: 'root', password: 'admin-password' },
    })
    expect(adminLogin.statusCode).toBe(200)
    const adminCookie = cookiesFrom(adminLogin)

    const createdKey = await app.inject({
      method: 'POST', url: '/api/v1/admin/user-keys',
      headers: writeHeaders(adminCookie), payload: { note: '端到端客户' },
    })
    expect(createdKey.statusCode).toBe(201)
    const accessKey = createdKey.json().accessKey as string
    const userId = createdKey.json().user.id as string

    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/user/key-login',
      headers: writeHeaders(), payload: { key: accessKey },
    })
    expect(login.statusCode).toBe(200)
    expect(login.json().principal.userLabel).toBe('端到端客户')
    const userCookie = cookiesFrom(login)

    const batch = await app.inject({
      method: 'POST', url: '/api/v1/user/task-batches', headers: writeHeaders(userCookie),
      payload: { requestedCount: 2 },
    })
    const batchId = batch.json().batchId as string
    const submitted = await app.inject({
      method: 'POST', url: `/api/v1/user/task-batches/${batchId}/chunks`,
      headers: writeHeaders(userCookie),
      payload: {
        batchId,
        idempotencyKey: crypto.randomUUID(),
        urls: ['https://one.test/pay', 'https://two.test/pay'],
      },
    })
    expect(submitted.statusCode).toBe(201)

    const studioLogin = await app.inject({
      method: 'POST', url: '/api/v1/auth/studio/exchange/studio-access-token',
      headers: writeHeaders(),
    })
    expect(studioLogin.statusCode).toBe(200)
    const studioCookie = cookiesFrom(studioLogin)
    const queue = await app.inject({
      method: 'GET', url: '/api/v1/studio/tasks', headers: { cookie: studioCookie },
    })
    expect(queue.json().items[0].userLabel).toBe('端到端客户')
    const [first, second] = queue.json().items as Array<{ publicId: string }>

    const opened = await app.inject({
      method: 'POST', url: `/api/v1/studio/tasks/${first.publicId}/open`,
      headers: writeHeaders(studioCookie),
    })
    const completed = await app.inject({
      method: 'POST', url: `/api/v1/studio/tasks/${first.publicId}/complete`,
      headers: writeHeaders(studioCookie),
      payload: { result: 'success', feedback: '支付成功', version: opened.json().version },
    })
    expect(completed.json()).toMatchObject({ status: 'success', feedback: '支付成功' })

    const next = await app.inject({
      method: 'POST', url: `/api/v1/studio/tasks/${first.publicId}/next`,
      headers: writeHeaders(studioCookie),
    })
    expect(next.json().task).toMatchObject({ publicId: second.publicId, status: 'processing' })

    const userDetail = await app.inject({
      method: 'GET', url: `/api/v1/user/tasks/${first.publicId}`, headers: { cookie: userCookie },
    })
    expect(userDetail.json()).toMatchObject({ status: 'success', feedback: '支付成功' })

    const disabled = await app.inject({
      method: 'PATCH', url: `/api/v1/admin/users/${userId}`,
      headers: writeHeaders(adminCookie), payload: { enabled: false },
    })
    expect(disabled.json()).toMatchObject({ enabled: false })

    const rejected = await app.inject({
      method: 'GET', url: '/api/v1/auth/user/session', headers: { cookie: userCookie },
    })
    expect(rejected.statusCode).toBe(401)
  })
})
