import Fastify from 'fastify'
import type { FastifyServerOptions } from 'fastify'
import { ZodError } from 'zod'
import { AppError, notFoundError } from './lib/errors.js'
import { registerHealthRoutes } from './modules/health/routes.js'
import { registerRequestContext } from './plugins/request-context.js'
import { registerSecurity } from './plugins/security.js'

export async function buildApp(
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options)

  await registerRequestContext(app)
  await registerSecurity(app)
  await registerHealthRoutes(app)

  app.setNotFoundHandler(async () => {
    throw notFoundError()
  })

  app.setErrorHandler(async (error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      })
    }

    if (error instanceof ZodError) {
      const fields = Object.fromEntries(
        error.issues.map((issue) => [issue.path.join('.') || 'request', issue.message]),
      )
      return reply.code(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数无效',
          requestId: request.id,
          fields,
        },
      })
    }

    request.log.error({ err: error }, 'unhandled request error')
    return reply.code(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        requestId: request.id,
      },
    })
  })

  await app.ready()
  return app
}
