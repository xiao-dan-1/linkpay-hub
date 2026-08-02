import { z } from 'zod'
import {
  completeTaskSchema,
  paymentUrlSchema,
  taskListQuerySchema,
} from '@linkpay/contracts'
import type { SessionPrincipal } from '@linkpay/contracts'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../../lib/errors.js'
import { taskService } from './task-service.js'

const createStudioTasksSchema = z.object({
  urls: z.array(paymentUrlSchema).min(1).max(200),
  at: z.string().trim().max(8192).optional(),
  cookieAt: z.string().trim().max(8192).optional(),
})

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

  // 工作室直接创建任务
  app.post(
    '/api/v1/studio/tasks',
    { onRequest: app.csrfProtection, preHandler: app.requireStudio },
    async (request, reply) => {
      const studioId = studioPrincipal(request.principal)
      const body = createStudioTasksSchema.parse(request.body)
      const result = await taskService.createStudioTasks(studioId, body)
      return reply.code(201).send(result)
    },
  )
}

