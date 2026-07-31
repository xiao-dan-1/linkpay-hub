import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { config } from '../config.js'
import { AppError } from '../lib/errors.js'

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function registerSecurity(app: FastifyInstance) {
  await app.register(cookie, {
    secret: config.COOKIE_SECRET,
    hook: 'onRequest',
  })
  await app.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    referrerPolicy: { policy: 'no-referrer' },
  })
  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  })
  await app.register(csrfProtection, {
    cookieKey: 'studio_csrf',
    cookieOpts: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: config.NODE_ENV === 'production',
      signed: true,
    },
    getToken: (request) => request.headers['x-csrf-token'] as string | undefined,
  })

  app.addHook('onRequest', async (request) => {
    if (!mutatingMethods.has(request.method)) return
    const origin = request.headers.origin
    if (origin && origin !== config.APP_ORIGIN) {
      throw new AppError(403, 'ORIGIN_FORBIDDEN', '请求来源不受信任')
    }
  })
}
