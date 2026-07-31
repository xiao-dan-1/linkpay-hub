import {
  taskListQuerySchema,
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

  app.get('/api/v1/admin/studio', { preHandler: app.requireAdmin }, async () => (
    adminService.getStudio()
  ))

  app.patch(
    '/api/v1/admin/studio',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => {
      const adminId = adminPrincipal(request.principal)
      const body = updateStudioSchema.parse(request.body)
      return adminService.updateStudio(adminId, body.name)
    },
  )

  app.post(
    '/api/v1/admin/studio/rotate-registration',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => adminService.rotateRegistration(adminPrincipal(request.principal)),
  )

  app.post(
    '/api/v1/admin/studio/rotate-access',
    { onRequest: app.csrfProtection, preHandler: app.requireAdmin },
    async (request) => adminService.rotateAccess(adminPrincipal(request.principal)),
  )

  app.get('/api/v1/admin/audit-logs', { preHandler: app.requireAdmin }, async (request) => {
    return adminService.listAuditLogs(auditQuerySchema.parse(request.query))
  })
}

