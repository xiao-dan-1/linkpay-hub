import type { FastifyInstance } from 'fastify'
import { prisma } from '../../db.js'

export async function registerHealthRoutes(app: FastifyInstance) {
  app.get('/health/live', async () => ({ status: 'live' }))

  app.get('/health/ready', async (_request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      return { status: 'ready' }
    } catch {
      return reply.code(503).send({ status: 'unavailable' })
    }
  })
}
