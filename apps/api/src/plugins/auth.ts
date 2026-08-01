import type { SessionPrincipal } from '@linkpay/contracts'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { AppError } from '../lib/errors.js'
import type { PrincipalType } from '../generated/prisma/enums.js'
import {
  sessionCookieNames,
  sessionService,
} from '../modules/auth/session-service.js'

declare module 'fastify' {
  interface FastifyRequest {
    principal: SessionPrincipal | null
  }

  interface FastifyInstance {
    requireUser: (request: FastifyRequest) => Promise<void>
    requireAdmin: (request: FastifyRequest) => Promise<void>
    requireStudio: (request: FastifyRequest) => Promise<void>
  }
}

export async function registerAuthPlugin(app: FastifyInstance) {
  app.decorateRequest('principal', null)

  const guard = (role: PrincipalType) => async (request: FastifyRequest) => {
    const principal = await sessionService.resolve(
      role,
      request.cookies[sessionCookieNames[role]],
    )
    if (!principal) {
      throw new AppError(401, 'AUTH_REQUIRED', '登录状态已失效')
    }
    request.principal = principal
  }

  app.decorate('requireUser', guard('user'))
  app.decorate('requireAdmin', guard('admin'))
  app.decorate('requireStudio', guard('studio'))
}
