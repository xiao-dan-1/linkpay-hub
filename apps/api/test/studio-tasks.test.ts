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

describe('studio task API', () => {
  let app: FastifyInstance
  let studioId: string
  let userId: string
  let studioCookie: string
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
      name: '测试工作室', registrationCodeHash: 'reg-studio', accessTokenHash: 'access-studio',
    } })
    studioId = studio.id
    const user = await prisma.user.create({ data: {
      username: 'demo', normalizedUsername: 'demo', passwordHash: 'hash', studioId,
    } })
    userId = user.id
    const session = await sessionService.create('studio', studioId, studio.tokenVersion)
    studioCookie = `${sessionCookieNames.studio}=${session.rawToken}`
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/csrf' })
    csrfCookie = cookiesFrom(csrf)
    csrfToken = csrf.json().token
  })

  function writeHeaders() {
    return {
      origin,
      cookie: `${studioCookie}; ${csrfCookie}`,
      'x-csrf-token': csrfToken,
    }
  }

  async function createTask(publicId: string, status: 'queued' | 'processing' | 'success' | 'failed' = 'queued') {
    return prisma.task.create({ data: {
      publicId,
      url: `https://${publicId.toLowerCase()}.test/pay`,
      status,
      userId,
      studioId,
      ...(status === 'processing' ? { processingStartedAt: new Date(), version: 1 } : {}),
      ...(status === 'success' || status === 'failed'
        ? { processingStartedAt: new Date(), completedAt: new Date(), version: 2 }
        : {}),
    } })
  }

  it('lists the studio queue oldest first', async () => {
    await createTask('TASK-ONE')
    await createTask('TASK-TWO')
    await createTask('TASK-THREE')

    const response = await app.inject({
      method: 'GET', url: '/api/v1/studio/tasks', headers: { cookie: studioCookie },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().items.map((task: { publicId: string }) => task.publicId)).toEqual([
      'TASK-ONE', 'TASK-TWO', 'TASK-THREE',
    ])
    expect(response.json().items[0].username).toBe('demo')
  })

  it('opens a queued task once and keeps terminal tasks read-only', async () => {
    await createTask('TASK-OPEN')
    await createTask('TASK-DONE', 'success')

    const first = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-OPEN/open', headers: writeHeaders(),
    })
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ status: 'processing', version: 1 })
    expect(first.json().processingStartedAt).toEqual(expect.any(String))

    const second = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-OPEN/open', headers: writeHeaders(),
    })
    expect(second.statusCode).toBe(200)
    expect(second.json().processingStartedAt).toBe(first.json().processingStartedAt)
    expect(await prisma.auditLog.count({ where: { action: 'task.processing_started' } })).toBe(1)

    const terminal = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-DONE/open', headers: writeHeaders(),
    })
    expect(terminal.statusCode).toBe(200)
    expect(terminal.json()).toMatchObject({ status: 'success', version: 2 })
  })

  it('requires processing state and matching version to complete a task', async () => {
    await createTask('TASK-COMPLETE')
    const queued = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-COMPLETE/complete', headers: writeHeaders(),
      payload: { result: 'success', feedback: '已完成', version: 0 },
    })
    expect(queued.statusCode).toBe(409)

    const opened = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-COMPLETE/open', headers: writeHeaders(),
    })
    const completed = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-COMPLETE/complete', headers: writeHeaders(),
      payload: { result: 'failed', feedback: '付款失败', version: opened.json().version },
    })
    expect(completed.statusCode).toBe(200)
    expect(completed.json()).toMatchObject({
      status: 'failed', feedback: '付款失败', version: 2,
    })
    expect(completed.json().completedAt).toEqual(expect.any(String))
  })

  it('allows only one concurrent completion', async () => {
    await createTask('TASK-RACE', 'processing')
    const request = (result: 'success' | 'failed') => app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-RACE/complete', headers: writeHeaders(),
      payload: { result, version: 1 },
    })
    const responses = await Promise.all([request('success'), request('failed')])
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 409])
    expect(await prisma.auditLog.count({ where: { action: 'task.completed' } })).toBe(1)
  })

  it('opens the next task from the full queue and blocks cross-studio access', async () => {
    await createTask('TASK-CURRENT', 'processing')
    await createTask('TASK-NEXT')
    await createTask('TASK-LATER')

    const next = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-CURRENT/next', headers: writeHeaders(),
    })
    expect(next.statusCode).toBe(200)
    expect(next.json().task).toMatchObject({ publicId: 'TASK-NEXT', status: 'processing' })

    const otherStudio = await prisma.studio.create({ data: {
      name: '其他工作室', registrationCodeHash: 'reg-other', accessTokenHash: 'access-other',
    } })
    const otherUser = await prisma.user.create({ data: {
      username: 'other', normalizedUsername: 'other', passwordHash: 'hash', studioId: otherStudio.id,
    } })
    await prisma.task.create({ data: {
      publicId: 'TASK-PRIVATE', url: 'https://private.test/pay',
      userId: otherUser.id, studioId: otherStudio.id,
    } })
    const forbidden = await app.inject({
      method: 'POST', url: '/api/v1/studio/tasks/TASK-PRIVATE/open', headers: writeHeaders(),
    })
    expect(forbidden.statusCode).toBe(404)
  })
})
