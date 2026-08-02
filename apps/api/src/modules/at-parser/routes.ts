import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { checkAt } from './at-service.js'
import { refreshAccessTokenFromCookie } from './cookie-refresh-service.js'

const atRequestSchema = z.object({
  at: z.string().trim().min(1).max(8192),
})

const cookieRefreshSchema = z.object({
  cookieAt: z.string().trim().min(1).max(8192),
})

export async function registerAtParserRoutes(app: FastifyInstance) {
  app.post(
    '/api/v1/user/at/check',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const body = atRequestSchema.parse(request.body)
      const result = await checkAt(body.at)
      return reply.send(result)
    },
  )

  app.post(
    '/api/v1/user/at/refresh',
    { onRequest: app.csrfProtection, preHandler: app.requireUser },
    async (request, reply) => {
      const body = cookieRefreshSchema.parse(request.body)
      const result = await refreshAccessTokenFromCookie(body.cookieAt)
      return reply.send(result)
    },
  )
}
