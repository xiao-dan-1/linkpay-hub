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

describe('administrator API', () => {
  let app: FastifyInstance
  let adminId: string
  let studioId: string
  let userId: string
  let adminCookie: string
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

    const studio = await prisma.studio.create({ data: {
      name: '测试工作室', accessTokenHash: 'access-admin',
    } })
    studioId = studio.id
    const user = await prisma.user.create({ data: {
      accessKeyHash: hashUserAccessKey('USR-ABCD-EFGH-JKMN-PQRS'),
      keyPrefix: 'USR-ABCD',
      keySuffix: 'PQRS',
      note: '客户 A',
      studioId,
    } })
    userId = user.id
    const admin = await prisma.admin.create({ data: {
      username: 'root', normalizedUsername: 'root', passwordHash: 'hash',
    } })
    adminId = admin.id
    const session = await sessionService.create('admin', admin.id)
    adminCookie = `${sessionCookieNames.admin}=${session.rawToken}`
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/csrf' })
    csrfCookie = cookiesFrom(csrf)
    csrfToken = csrf.json().token
  })

  function writeHeaders() {
    return {
      origin,
      cookie: `${adminCookie}; ${csrfCookie}`,
      'x-csrf-token': csrfToken,
    }
  }

  it('returns dashboard counts and paginated task, user, and audit reads', async () => {
    for (const [suffix, status] of [
      ['ONE', 'queued'], ['TWO', 'processing'], ['THREE', 'success'], ['FOUR', 'failed'],
    ] as const) {
      await prisma.task.create({ data: {
        publicId: `TASK-${suffix}`,
        url: `https://${suffix.toLowerCase()}.test/pay`,
        status,
        userId,
        studioId,
      } })
    }
    await prisma.auditLog.create({ data: {
      actorType: 'admin', actorId: adminId, action: 'fixture.created',
    } })

    const dashboard = await app.inject({
      method: 'GET', url: '/api/v1/admin/dashboard', headers: { cookie: adminCookie },
    })
    expect(dashboard.statusCode).toBe(200)
    expect(dashboard.json()).toEqual({
      users: 1, tasks: 4, queued: 1, processing: 1, success: 1, failed: 1,
    })

    const tasks = await app.inject({
      method: 'GET', url: '/api/v1/admin/tasks?limit=2', headers: { cookie: adminCookie },
    })
    expect(tasks.statusCode).toBe(200)
    expect(tasks.json().items.map((task: { publicId: string }) => task.publicId)).toEqual([
      'TASK-FOUR', 'TASK-THREE',
    ])
    expect(tasks.json().page.hasMore).toBe(true)
    const detail = await app.inject({
      method: 'GET', url: '/api/v1/admin/tasks/TASK-FOUR', headers: { cookie: adminCookie },
    })
    expect(detail.statusCode).toBe(200)
    expect(detail.json()).toMatchObject({ publicId: 'TASK-FOUR', userLabel: '客户 A' })

    const users = await app.inject({
      method: 'GET', url: '/api/v1/admin/users', headers: { cookie: adminCookie },
    })
    expect(users.statusCode).toBe(200)
    expect(users.json().items[0]).toMatchObject({
      id: userId,
      maskedKey: 'USR-ABCD-••••-••••-PQRS',
      note: '客户 A',
      enabled: true,
      taskCount: 4,
    })

    const audits = await app.inject({
      method: 'GET', url: '/api/v1/admin/audit-logs', headers: { cookie: adminCookie },
    })
    expect(audits.statusCode).toBe(200)
    expect(audits.json().items[0]).toMatchObject({ action: 'fixture.created' })
  })

  it('creates a reusable key, returns it once, and lists only safe metadata', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/user-keys',
      headers: writeHeaders(),
      payload: { note: '客户 B' },
    })
    expect(created.statusCode).toBe(201)
    const payload = created.json()
    expect(payload.accessKey).toMatch(/^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/)
    expect(payload.user).toMatchObject({ note: '客户 B', enabled: true, taskCount: 0 })

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: payload.user.id } })
    expect(stored.accessKeyHash).toHaveLength(64)
    expect(stored.accessKeyHash).not.toBe(payload.accessKey)

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users?search=%E5%AE%A2%E6%88%B7%20B',
      headers: { cookie: adminCookie },
    })
    expect(listed.statusCode).toBe(200)
    expect(listed.json().items).toHaveLength(1)
    expect(listed.json().items[0]).toMatchObject({
      id: payload.user.id,
      note: '客户 B',
      maskedKey: expect.stringContaining('••••'),
    })
    expect(JSON.stringify(listed.json())).not.toContain(payload.accessKey)
    expect(await prisma.auditLog.count({ where: { action: 'user.key_created' } })).toBe(1)
  })

  it('disables a user and revokes all user sessions in the same operation', async () => {
    const session = await sessionService.create('user', userId)
    const userCookie = `${sessionCookieNames.user}=${session.rawToken}`
    const updated = await app.inject({
      method: 'PATCH', url: `/api/v1/admin/users/${userId}`,
      headers: writeHeaders(), payload: { enabled: false },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json()).toMatchObject({ id: userId, enabled: false })
    expect(await prisma.session.count({ where: { principalType: 'user', principalId: userId } })).toBe(0)
    const rejected = await app.inject({
      method: 'GET', url: '/api/v1/auth/user/session', headers: { cookie: userCookie },
    })
    expect(rejected.statusCode).toBe(401)
    expect(await prisma.auditLog.count({ where: { action: 'user.key_enabled_updated' } })).toBe(1)
  })

  it('updates the studio and rotates its one-time access link', async () => {
    const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } })
    const oldStudioSession = await sessionService.create('studio', studioId, studio.tokenVersion)
    const oldStudioCookie = `${sessionCookieNames.studio}=${oldStudioSession.rawToken}`

    const current = await app.inject({
      method: 'GET', url: '/api/v1/admin/studio', headers: { cookie: adminCookie },
    })
    expect(current.statusCode).toBe(200)
    expect(current.json()).toMatchObject({ id: studioId, name: '测试工作室' })

    const renamed = await app.inject({
      method: 'PATCH', url: '/api/v1/admin/studio',
      headers: writeHeaders(), payload: { name: '正式工作室' },
    })
    expect(renamed.statusCode).toBe(200)
    expect(renamed.json().name).toBe('正式工作室')

    const access = await app.inject({
      method: 'POST', url: '/api/v1/admin/studio/rotate-access', headers: writeHeaders(),
    })
    expect(access.statusCode).toBe(200)
    expect(access.json().url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/studio\/.+$/)
    const rejected = await app.inject({
      method: 'GET', url: '/api/v1/auth/studio/session', headers: { cookie: oldStudioCookie },
    })
    expect(rejected.statusCode).toBe(401)
    expect(await prisma.auditLog.count({
      where: { action: { in: ['studio.updated', 'studio.access_rotated'] } },
    })).toBe(2)
  })
})
