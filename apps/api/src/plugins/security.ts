import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { config } from '../config.js'

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
      secure: new URL(config.APP_ORIGIN).protocol === 'https:',
      signed: true,
    },
    getToken: (request) => request.headers['x-csrf-token'] as string | undefined,
  })

  // Origin check disabled — CSRF token provides sufficient protection
}
