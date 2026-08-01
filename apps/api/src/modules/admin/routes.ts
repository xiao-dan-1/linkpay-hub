import {
  createUserKeySchema,
  taskListQuerySchema,
  updateUserKeySchema,
  trendsQuerySchema,
  updateStudioSchema,
  updateUserEnabledSchema,
} from '@studio/contracts'
import type { SessionPrincipal } from '@studio/contracts'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/errors.js'
import { adminService } from './admin-service.js'

const listQuerySchema = z.object({
  search: z.string().trim().max(500).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const auditQuerySchema = listQuerySchema.pick({ cursor: true, limit: true })

function adminPrincipal(principal: SessionPrincipal | null) {
  if (!principal || principal.role !== 'admin') {
    throw new AppError(401, 'AUTH_REQUIRED', '管理员登录状态已失效')
  }
  return principal.id
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/v1/admin/dashboard', { preHandler: app.requireAdmin }, async () => (
    adminService.dashboard()
  ))

  app.get('/api/v1/admin/trends', { preHandler: app.requireAdmin }, async (request) => {
    const { days } = trendsQuerySchema.parse(request.query)
    return adminService.trends(days)
  })

  app.get('/api/v1/admin/tasks', { preHandler: app.requireAdmin }, async (request) => {
    return adminService.listTasks(taskListQuerySchema.parse(request.query))
  })

  app.get('/api/v1/admin/tasks/:publicId', { preHandler: app.requireAdmin }, async (request) => {
    const { publicId } = request.params as { publicId: string }
    return adminService.getTask(publicId)
  })

  app.get('/api/v1/admin/users', { preHandler: app.requireAdmin }, async (request) => {
    return adminService.listUsers(listQuerySchema.parse(request.query))
  })

  app.post(
    '/api/v1/admin/user-keys',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request, reply) => {
      const adminId = adminPrincipal(request.principal)
      const body = createUserKeySchema.parse(request.body)
      return reply.code(201).send(await adminService.createUserKey(adminId, body.note, body.key))
    },
  )

  app.patch(
    '/api/v1/admin/user-keys/:userId',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => {
      const adminId = adminPrincipal(request.principal)
      const { userId } = request.params as { userId: string }
      const body = updateUserKeySchema.parse(request.body)
      return adminService.updateUserKey(adminId, userId, body)
    },
  )

  app.patch(
    '/api/v1/admin/users/:userId',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => {
      const adminId = adminPrincipal(request.principal)
      const { userId } = request.params as { userId: string }
      const body = updateUserEnabledSchema.parse(request.body)
      return adminService.updateUserEnabled(adminId, userId, body.enabled)
    },
  )

  app.delete(
    '/api/v1/admin/users/:userId',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request, reply) => {
      const adminId = adminPrincipal(request.principal)
      const { userId } = request.params as { userId: string }
      await adminService.deleteUser(adminId, userId)
      return reply.code(204).send()
    },
  )

  app.get(
    '/api/v1/admin/users/:userId/key',
    { preHandler: app.requireAdmin },
    async (request) => {
      const adminId = adminPrincipal(request.principal)
      const { userId } = request.params as { userId: string }
      return adminService.revealUserKey(adminId, userId)
    },
  )

  app.get('/api/v1/admin/studio', { preHandler: app.requireAdmin }, async () => (
    adminService.getStudio()
  ))

  app.get(
    '/api/v1/admin/studios',
    { preHandler: app.requireAdmin },
    async () => adminService.listStudios(),
  )

  app.post(
    '/api/v1/admin/studio',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request, reply) => {
      const adminId = adminPrincipal(request.principal)
      const body = updateStudioSchema.parse(request.body)
      return reply.code(201).send(await adminService.createStudio(adminId, body.name))
    },
  )

  app.patch(
    '/api/v1/admin/studios/:studioId',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => {
      const adminId = adminPrincipal(request.principal)
      const { studioId } = request.params as { studioId: string }
      const body = updateStudioSchema.parse(request.body)
      return adminService.updateStudio(adminId, studioId, body.name)
    },
  )

  app.post(
    '/api/v1/admin/studios/:studioId/rotate-access',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => {
      const { studioId } = request.params as { studioId: string }
      return adminService.rotateAccess(adminPrincipal(request.principal), studioId)
    },
  )

  app.get('/api/v1/admin/audit-logs', { preHandler: app.requireAdmin }, async (request) => {
    return adminService.listAuditLogs(auditQuerySchema.parse(request.query))
  })
}

