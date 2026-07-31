import type { FastifyInstance } from 'fastify'

export async function registerRequestContext(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id)
  })
}
