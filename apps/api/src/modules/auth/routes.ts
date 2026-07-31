import {
  adminLoginSchema,
  userLoginSchema,
  userRegistrationSchema,
} from '@studio/contracts'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { prisma } from '../../db.js'
import { AppError } from '../../lib/errors.js'
import { hashPassword, verifyPassword } from '../../lib/passwords.js'
import { hashToken } from '../../lib/tokens.js'
import {
  clearSessionCookie,
  sessionCookieNames,
  sessionService,
  setSessionCookie,
} from './session-service.js'

function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase('en-US')
}

function rawSession(request: FastifyRequest, role: keyof typeof sessionCookieNames) {
  return request.cookies[sessionCookieNames[role]]
}

async function issueSession(
  reply: FastifyReply,
  role: 'user' | 'admin' | 'studio',
  principalId: string,
  studioTokenVersion?: number,
) {
  const session = await sessionService.create(role, principalId, studioTokenVersion)
  setSessionCookie(reply, role, session.rawToken, session.expiresAt)
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/v1/csrf', async (_request, reply) => ({
    token: await reply.generateCsrf(),
  }))

  app.post(
    '/api/v1/auth/register/:registrationCode',
    { onRequest: app.csrfProtection },
    async (request, reply) => {
      const body = userRegistrationSchema.parse(request.body)
      const { registrationCode } = request.params as { registrationCode: string }
      const studio = await prisma.studio.findUnique({
        where: { registrationCodeHash: hashToken(registrationCode) },
      })
      if (!studio?.enabled) {
        throw new AppError(404, 'REGISTRATION_LINK_INVALID', '注册链接无效或已停用')
      }

      const normalizedUsername = normalizeUsername(body.username)
      if (await prisma.user.findUnique({ where: { normalizedUsername } })) {
        throw new AppError(409, 'USERNAME_TAKEN', '该账号已被使用')
      }

      const user = await prisma.user.create({
        data: {
          username: body.username.trim(),
          normalizedUsername,
          passwordHash: await hashPassword(body.password),
          studioId: studio.id,
        },
      })
      await prisma.auditLog.create({
        data: {
          actorType: 'user',
          actorId: user.id,
          action: 'user.registered',
          targetType: 'user',
          targetId: user.id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      })
      await issueSession(reply, 'user', user.id)
      return reply.code(201).send({
        principal: {
          id: user.id,
          role: 'user',
          username: user.username,
          studioId: user.studioId,
        },
      })
    },
  )

  app.post(
    '/api/v1/auth/user/login',
    { onRequest: app.csrfProtection },
    async (request, reply) => {
      const body = userLoginSchema.parse(request.body)
      const user = await prisma.user.findUnique({
        where: { normalizedUsername: normalizeUsername(body.username) },
        include: { studio: true },
      })
      if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
        throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', '账号或密码错误')
      }
      if (!user.enabled || !user.studio.enabled) {
        throw new AppError(403, 'ACCOUNT_DISABLED', '账号已停用')
      }
      await issueSession(reply, 'user', user.id)
      return { principal: {
        id: user.id, role: 'user', username: user.username, studioId: user.studioId,
      } }
    },
  )

  app.get('/api/v1/auth/user/session', { preHandler: app.requireUser }, async (request) => ({
    principal: request.principal,
  }))

  app.post('/api/v1/auth/user/logout', { onRequest: app.csrfProtection }, async (request, reply) => {
    await sessionService.destroy(rawSession(request, 'user'))
    clearSessionCookie(reply, 'user')
    return reply.code(204).send()
  })

  app.post('/api/v1/auth/admin/login', { onRequest: app.csrfProtection }, async (request, reply) => {
    const body = adminLoginSchema.parse(request.body)
    const admin = await prisma.admin.findUnique({
      where: { normalizedUsername: normalizeUsername(body.username) },
    })
    if (!admin || !(await verifyPassword(admin.passwordHash, body.password))) {
      throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', '账号或密码错误')
    }
    if (!admin.enabled) {
      throw new AppError(403, 'ACCOUNT_DISABLED', '账号已停用')
    }
    await issueSession(reply, 'admin', admin.id)
    return { principal: { id: admin.id, role: 'admin', username: admin.username } }
  })

  app.get('/api/v1/auth/admin/session', { preHandler: app.requireAdmin }, async (request) => ({
    principal: request.principal,
  }))

  app.post('/api/v1/auth/admin/logout', { onRequest: app.csrfProtection }, async (request, reply) => {
    await sessionService.destroy(rawSession(request, 'admin'))
    clearSessionCookie(reply, 'admin')
    return reply.code(204).send()
  })

  app.post(
    '/api/v1/auth/studio/exchange/:accessToken',
    { onRequest: app.csrfProtection },
    async (request, reply) => {
      const { accessToken } = request.params as { accessToken: string }
      const studio = await prisma.studio.findUnique({
        where: { accessTokenHash: hashToken(accessToken) },
      })
      if (!studio?.enabled) {
        throw new AppError(404, 'STUDIO_LINK_INVALID', '工作室入口无效或已停用')
      }
      await issueSession(reply, 'studio', studio.id, studio.tokenVersion)
      return { principal: { id: studio.id, role: 'studio', studioId: studio.id } }
    },
  )

  app.get('/api/v1/auth/studio/session', { preHandler: app.requireStudio }, async (request) => ({
    principal: request.principal,
  }))

  app.post('/api/v1/auth/studio/logout', { onRequest: app.csrfProtection }, async (request, reply) => {
    await sessionService.destroy(rawSession(request, 'studio'))
    clearSessionCookie(reply, 'studio')
    return reply.code(204).send()
  })
}
