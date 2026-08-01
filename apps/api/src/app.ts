import Fastify from 'fastify'
import type { FastifyServerOptions } from 'fastify'
import { ZodError } from 'zod'
import { AppError, notFoundError } from './lib/errors.js'
import { registerAuthRoutes } from './modules/auth/routes.js'
import { registerAdminRoutes } from './modules/admin/routes.js'
import { registerHealthRoutes } from './modules/health/routes.js'
import { registerUserTaskRoutes } from './modules/tasks/user-routes.js'
import { registerStudioTaskRoutes } from './modules/tasks/studio-routes.js'
import { registerLinkGeneratorRoutes } from './modules/link-generator/routes.js'
import { registerAtParserRoutes } from './modules/at-parser/routes.js'
import { registerAuthPlugin } from './plugins/auth.js'
import { registerRequestContext } from './plugins/request-context.js'
import { registerSecurity } from './plugins/security.js'

export async function buildApp(
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options)

  await registerRequestContext(app)
  await registerSecurity(app)
  await registerAuthPlugin(app)
  await registerHealthRoutes(app)
  await registerAuthRoutes(app)
  await registerAdminRoutes(app)
  await registerUserTaskRoutes(app)
  await registerAtParserRoutes(app)
  await registerLinkGeneratorRoutes(app)
  await registerStudioTaskRoutes(app)

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
