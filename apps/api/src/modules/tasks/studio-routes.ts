import {
  completeTaskSchema,
  taskListQuerySchema,
} from '@studio/contracts'
import type { SessionPrincipal } from '@studio/contracts'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../../lib/errors.js'
import { taskService } from './task-service.js'

function studioPrincipal(principal: SessionPrincipal | null) {
  if (!principal || principal.role !== 'studio' || !principal.studioId) {
    throw new AppError(401, 'AUTH_REQUIRED', '工作室访问状态已失效')
  }
  return principal.studioId
}

export async function registerStudioTaskRoutes(app: FastifyInstance) {
  app.get(
    '/api/v1/studio/tasks',
    { preHandler: app.requireStudio },
    async (request) => {
      const studioId = studioPrincipal(request.principal)
      const query = taskListQuerySchema.parse(request.query)
      return taskService.listStudioTasks({ studioId, ...query })
    },
  )

  app.post(
    '/api/v1/studio/tasks/:publicId/open',
    { onRequest: app.csrfProtection, preHandler: app.requireStudio },
    async (request) => {
      const studioId = studioPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      return taskService.openStudioTask(studioId, publicId)
    },
  )

  app.post(
    '/api/v1/studio/tasks/:publicId/complete',
    { onRequest: app.csrfProtection, preHandler: app.requireStudio },
    async (request) => {
      const studioId = studioPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      const body = completeTaskSchema.parse(request.body)
      return taskService.completeStudioTask(studioId, publicId, body)
    },
  )

  app.post(
    '/api/v1/studio/tasks/:publicId/next',
    { onRequest: app.csrfProtection, preHandler: app.requireStudio },
    async (request) => {
      const studioId = studioPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      return { task: await taskService.nextStudioTask(studioId, publicId) }
    },
  )
}

