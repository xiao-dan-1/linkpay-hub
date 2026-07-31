import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'
import {
  sessionCookieNames,
  sessionService,
} from '../src/modules/auth/session-service.js'

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
      name: '测试工作室', registrationCodeHash: 'reg-admin', accessTokenHash: 'access-admin',
    } })
    studioId = studio.id
    const user = await prisma.user.create({ data: {
      username: 'demo', normalizedUsername: 'demo', passwordHash: 'hash', studioId,
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
    expect(detail.json()).toMatchObject({ publicId: 'TASK-FOUR', username: 'demo' })

    const users = await app.inject({
      method: 'GET', url: '/api/v1/admin/users', headers: { cookie: adminCookie },
    })
    expect(users.statusCode).toBe(200)
    expect(users.json().items[0]).toMatchObject({ id: userId, username: 'demo', enabled: true })

    const audits = await app.inject({
      method: 'GET', url: '/api/v1/admin/audit-logs', headers: { cookie: adminCookie },
    })
    expect(audits.statusCode).toBe(200)
    expect(audits.json().items[0]).toMatchObject({ action: 'fixture.created' })
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
    expect(await prisma.auditLog.count({ where: { action: 'user.enabled_updated' } })).toBe(1)
  })

  it('updates the studio and rotates one-time registration and access links', async () => {
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

    const registration = await app.inject({
      method: 'POST', url: '/api/v1/admin/studio/rotate-registration', headers: writeHeaders(),
    })
    expect(registration.statusCode).toBe(200)
    expect(registration.json().url).toMatch(/^http:\/\/127\.0\.0\.1:5173\/s\/.+\/register$/)

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
      where: { action: { in: ['studio.updated', 'studio.registration_rotated', 'studio.access_rotated'] } },
    })).toBe(3)
  })
})
