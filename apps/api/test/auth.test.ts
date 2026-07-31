import { createHash } from 'node:crypto'
import argon2 from 'argon2'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../src/app.js'
import { prisma } from '../src/db.js'

const origin = 'http://127.0.0.1:5173'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

function cookiesFrom(response: { headers: Record<string, unknown> }) {
  const header = response.headers['set-cookie']
  const values = Array.isArray(header) ? header : header ? [header] : []
  return values.map((value) => String(value).split(';')[0]).join('; ')
}

describe('production authentication', () => {
  let app: FastifyInstance
  const registrationCode = 'registration-code-secret'
  const studioAccessToken = 'studio-access-token-secret'

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  beforeEach(async () => {
    await prisma.submissionChunk.deleteMany()
    await prisma.submissionBatch.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.session.deleteMany()
    await prisma.task.deleteMany()
    await prisma.user.deleteMany()
    await prisma.admin.deleteMany()
    await prisma.studio.deleteMany()

    await prisma.studio.create({
      data: {
        name: '测试工作室',
        registrationCodeHash: digest(registrationCode),
        accessTokenHash: digest(studioAccessToken),
      },
    })
    await prisma.admin.create({
      data: {
        username: 'admin',
        normalizedUsername: 'admin',
        passwordHash: await argon2.hash('AdminPass123!'),
      },
    })
  })

  afterAll(async () => {
    await app.close()
  })

  async function csrf() {
    const response = await app.inject({ method: 'GET', url: '/api/v1/csrf' })
    expect(response.statusCode).toBe(200)
    return { token: response.json().token as string, cookie: cookiesFrom(response) }
  }

  it('registers a user, creates a secure session, and revokes it when disabled', async () => {
    const protection = await csrf()
    const registration = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/register/${registrationCode}`,
      headers: {
        origin,
        cookie: protection.cookie,
        'x-csrf-token': protection.token,
      },
      payload: { username: 'demo', password: 'DemoPass123!' },
    })

    expect(registration.statusCode).toBe(201)
    expect(registration.json()).toMatchObject({
      principal: { role: 'user', username: 'demo' },
    })
    expect(String(registration.headers['set-cookie'])).toContain('HttpOnly')
    expect(String(registration.headers['set-cookie'])).toContain('SameSite=Lax')

    const userCookie = cookiesFrom(registration)
    const session = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/user/session',
      headers: { cookie: userCookie },
    })
    expect(session.statusCode).toBe(200)

    const user = await prisma.user.findUniqueOrThrow({ where: { normalizedUsername: 'demo' } })
    await prisma.user.update({ where: { id: user.id }, data: { enabled: false } })

    const rejected = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/user/session',
      headers: { cookie: userCookie },
    })
    expect(rejected.statusCode).toBe(401)
  })

  it('uses separate administrator and studio sessions and invalidates rotated studio access', async () => {
    const adminProtection = await csrf()
    const adminLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/admin/login',
      headers: {
        origin,
        cookie: adminProtection.cookie,
        'x-csrf-token': adminProtection.token,
      },
      payload: { username: 'admin', password: 'AdminPass123!' },
    })
    expect(adminLogin.statusCode).toBe(200)
    expect(adminLogin.json().principal.role).toBe('admin')

    const studioProtection = await csrf()
    const studioLogin = await app.inject({
      method: 'POST',
      url: `/api/v1/auth/studio/exchange/${studioAccessToken}`,
      headers: {
        origin,
        cookie: studioProtection.cookie,
        'x-csrf-token': studioProtection.token,
      },
    })
    expect(studioLogin.statusCode).toBe(200)
    const studioCookie = cookiesFrom(studioLogin)

    const studio = await prisma.studio.findFirstOrThrow()
    await prisma.studio.update({
      where: { id: studio.id },
      data: { tokenVersion: { increment: 1 } },
    })

    const rejected = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/studio/session',
      headers: { cookie: studioCookie },
    })
    expect(rejected.statusCode).toBe(401)
  })
})
