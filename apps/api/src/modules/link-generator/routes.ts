import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { generateKakaoPayLink } from './link-gen-service.js'

const requestSchema = z.object({
  at: z.string().trim().min(1).max(8192),
})

export async function registerLinkGeneratorRoutes(app: FastifyInstance) {
  app.post(
    '/api/v1/user/at/generate-pay-link',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const body = requestSchema.parse(request.body)
      const result = await generateKakaoPayLink(body.at)
      return reply.send(result)
    },
  )
}
