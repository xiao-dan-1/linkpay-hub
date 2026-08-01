import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { createLinkJob, checkLinkJob } from './link-gen-service.js'

const requestSchema = z.object({
  at: z.string().trim().min(1).max(8192),
})

export async function registerLinkGeneratorRoutes(app: FastifyInstance) {
  app.post(
    '/api/v1/user/at/generate-pay-link',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const body = requestSchema.parse(request.body)
      const result = await createLinkJob(body.at)
      return reply.send(result)
    },
  )

  app.get(
    '/api/v1/user/at/generate-pay-link/:jobId',
    { preHandler: app.requireUser },
    async (request) => {
      const { jobId } = request.params as { jobId: string }
      return checkLinkJob(jobId)
    },
  )
}
