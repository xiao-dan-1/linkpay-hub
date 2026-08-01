import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import {
  sessionCookieNames,
  sessionService,
} from '../src/modules/auth/session-service.js'
import { hashUserAccessKey } from '../src/lib/user-keys.js'

const origin = 'http://127.0.0.1:5173'
function cookiesFrom(response: { headers: Record<string, unknown> }) {
  const header = response.headers['set-cookie']
  const values = Array.isArray(header) ? header : header ? [header] : []
  return values.map((value) => String(value).split(';')[0]).join('; ')
}

describe('user task API', () => {
  let app: FastifyInstance
  let userCookie: string
  let csrfCookie: string
  let csrfToken: string
  let userId: string

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
    const studio = await prisma.studio.create({ data: {
      name: '测试工作室', accessTokenHash: 'access-user',
    } })
    const user = await prisma.user.create({ data: {
      accessKeyHash: hashUserAccessKey('USR-ABCD-EFGH-JKMN-PQRS'),
      keyPrefix: 'USR-ABCD', keySuffix: 'PQRS', note: '客户 A', studioId: studio.id,
    } })
    userId = user.id
    const session = await sessionService.create('user', user.id)
    userCookie = `${sessionCookieNames.user}=${session.rawToken}`
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/csrf' })
    csrfCookie = cookiesFrom(csrf)
    csrfToken = csrf.json().token
  })

  it('creates idempotent chunks and lists newest tasks first', async () => {
    const batch = await app.inject({
      method: 'POST', url: '/api/v1/user/task-batches',
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload: { requestedCount: 2 },
    })
    expect(batch.statusCode).toBe(201)
    const batchId = batch.json().batchId as string
    const idempotencyKey = crypto.randomUUID()
    const payload = {
      batchId, idempotencyKey,
      urls: ['https://one.test/pay', 'https://two.test/pay'],
    }
    const created = await app.inject({
      method: 'POST', url: `/api/v1/user/task-batches/${batchId}/chunks`,
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload,
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().taskPublicIds).toHaveLength(2)

    const repeated = await app.inject({
      method: 'POST', url: `/api/v1/user/task-batches/${batchId}/chunks`,
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload,
    })
    expect(repeated.statusCode).toBe(200)
    expect(await prisma.task.count({ where: { userId } })).toBe(2)

    const list = await app.inject({
      method: 'GET', url: '/api/v1/user/tasks', headers: { cookie: userCookie },
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().items.map((task: { url: string }) => task.url)).toEqual([
      'https://two.test/pay', 'https://one.test/pay',
    ])
  })

  it('does not expose another user task', async () => {
    const studio = await prisma.studio.findFirstOrThrow()
    const other = await prisma.user.create({ data: {
      accessKeyHash: hashUserAccessKey('USR-WXYZ-2345-6789-ABCD'),
      keyPrefix: 'USR-WXYZ', keySuffix: 'ABCD', studioId: studio.id,
    } })
    await prisma.task.create({ data: {
      publicId: 'TASK-PRIVATE', url: 'https://private.test', userId: other.id, studioId: studio.id,
    } })
    const response = await app.inject({
      method: 'GET', url: '/api/v1/user/tasks/TASK-PRIVATE', headers: { cookie: userCookie },
    })
    expect(response.statusCode).toBe(404)
  })

  it('accepts a 200-link transport chunk and rejects non-HTTP links', async () => {
    const batch = await app.inject({
      method: 'POST', url: '/api/v1/user/task-batches',
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload: { requestedCount: 200 },
    })
    const batchId = batch.json().batchId as string
    const urls = Array.from({ length: 200 }, (_, index) => `https://bulk.test/${index}`)
    const created = await app.inject({
      method: 'POST', url: `/api/v1/user/task-batches/${batchId}/chunks`,
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload: { batchId, idempotencyKey: crypto.randomUUID(), urls },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().createdCount).toBe(200)

    const invalid = await app.inject({
      method: 'POST', url: `/api/v1/user/task-batches/${batchId}/chunks`,
      headers: { origin, cookie: `${userCookie}; ${csrfCookie}`, 'x-csrf-token': csrfToken },
      payload: { batchId, idempotencyKey: crypto.randomUUID(), urls: ['javascript:alert(1)'] },
    })
    expect(invalid.statusCode).toBe(400)
  })

  it('returns a stable cursor for the next newest-first page', async () => {
    const studio = await prisma.studio.findFirstOrThrow()
    for (const suffix of ['ONE', 'TWO', 'THREE']) {
      await prisma.task.create({ data: {
        publicId: `TASK-${suffix}`,
        url: `https://${suffix.toLowerCase()}.test/pay`,
        userId,
        studioId: studio.id,
      } })
    }

    const first = await app.inject({
      method: 'GET', url: '/api/v1/user/tasks?limit=2', headers: { cookie: userCookie },
    })
    expect(first.statusCode).toBe(200)
    expect(first.json().items.map((task: { publicId: string }) => task.publicId)).toEqual([
      'TASK-THREE', 'TASK-TWO',
    ])
    expect(first.json().page.hasMore).toBe(true)
    expect(first.json().page.nextCursor).toEqual(expect.any(String))

    const second = await app.inject({
      method: 'GET',
      url: `/api/v1/user/tasks?limit=2&cursor=${encodeURIComponent(first.json().page.nextCursor)}`,
      headers: { cookie: userCookie },
    })
    expect(second.statusCode).toBe(200)
    expect(second.json().items.map((task: { publicId: string }) => task.publicId)).toEqual([
      'TASK-ONE',
    ])
    expect(second.json().page).toEqual({ hasMore: false, nextCursor: null })
  })
})
