import {
  createTaskBatchSchema,
  createTaskChunkSchema,
  taskListQuerySchema,
  updateTaskSchema,
} from '@linkpay/contracts'
import type { SessionPrincipal } from '@linkpay/contracts'
import type { FastifyInstance } from 'fastify'
import { AppError } from '../../lib/errors.js'
import { taskService } from './task-service.js'

function userPrincipal(principal: SessionPrincipal | null) {
  if (!principal || principal.role !== 'user' || !principal.studioId) {
    throw new AppError(401, 'AUTH_REQUIRED', '登录状态已失效')
  }
  return { id: principal.id, studioId: principal.studioId }
}

export async function registerUserTaskRoutes(app: FastifyInstance) {
  app.post(
    '/api/v1/user/task-batches',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const principal = userPrincipal(request.principal)
      const body = createTaskBatchSchema.parse(request.body)
      const batch = await taskService.createBatch(principal.id, body.requestedCount)
      return reply.code(201).send({
        batchId: batch.id,
        requestedCount: batch.requestedCount,
        createdCount: batch.createdCount,
      })
    },
  )

  app.post(
    '/api/v1/user/task-batches/:batchId/chunks',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const principal = userPrincipal(request.principal)
      const { batchId } = request.params as { batchId: string }
      const body = createTaskChunkSchema.parse(request.body)
      if (batchId !== body.batchId) {
        throw new AppError(400, 'BATCH_ID_MISMATCH', '任务批次编号不一致')
      }
      const result = await taskService.createChunk(principal.id, principal.studioId, body)
      return reply.code(result.replayed ? 200 : 201).send(result.response)
    },
  )

  app.get(
    '/api/v1/user/tasks',
    { preHandler: app.requireUser },
    async (request) => {
      const principal = userPrincipal(request.principal)
      const query = taskListQuerySchema.parse(request.query)
      return taskService.listUserTasks({ userId: principal.id, ...query })
    },
  )

  app.get(
    '/api/v1/user/tasks/:publicId',
    { preHandler: app.requireUser },
    async (request) => {
      const principal = userPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      return taskService.getUserTask(principal.id, publicId)
    },
  )

  app.patch(
    '/api/v1/user/tasks/:publicId',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request) => {
      const principal = userPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      return taskService.updateTask(principal.id, publicId, updateTaskSchema.parse(request.body))
    },
  )

  app.delete(
    '/api/v1/user/tasks/:publicId',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const principal = userPrincipal(request.principal)
      const { publicId } = request.params as { publicId: string }
      await taskService.deleteTask(principal.id, publicId)
      return reply.code(204).send()
    },
  )
}
