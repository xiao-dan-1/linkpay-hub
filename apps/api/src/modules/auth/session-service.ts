import type { SessionPrincipal } from '@studio/contracts'
import type { FastifyReply } from 'fastify'
import { config } from '../../config.js'
import { prisma } from '../../db.js'
import type { PrincipalType } from '../../generated/prisma/enums.js'
import { createOpaqueToken, hashToken } from '../../lib/tokens.js'
import { sessionUserLabel } from '../../lib/user-keys.js'

export const sessionCookieNames = {
  user: 'studio_user_session',
  admin: 'studio_admin_session',
  studio: 'studio_workspace_session',
} as const satisfies Record<PrincipalType, string>

function hoursFor(role: PrincipalType) {
  return role === 'studio' ? config.STUDIO_SESSION_HOURS : config.USER_SESSION_HOURS
}

function cookieOptions(expiresAt: Date) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.NODE_ENV === 'production',
    expires: expiresAt,
  }
}

export class SessionService {
  async create(
    role: PrincipalType,
    principalId: string,
    studioTokenVersion?: number,
  ) {
    const rawToken = createOpaqueToken()
    const expiresAt = new Date(Date.now() + hoursFor(role) * 60 * 60 * 1000)
    await prisma.session.create({
      data: {
        tokenHash: hashToken(rawToken),
        principalType: role,
        principalId,
        studioTokenVersion,
        expiresAt,
      },
    })
    return { rawToken, expiresAt }
  }

  async resolve(role: PrincipalType, rawToken?: string): Promise<SessionPrincipal | null> {
    if (!rawToken) return null
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    })
    if (!session || session.principalType !== role) return null
    if (session.expiresAt <= new Date()) {
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }

    let principal: SessionPrincipal | null = null
    if (role === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: session.principalId },
        include: { studio: true },
      })
      if (user?.enabled && user.studio.enabled) {
        principal = {
          id: user.id,
          role,
          userLabel: sessionUserLabel(user),
          studioId: user.studioId,
        }
      }
    } else if (role === 'admin') {
      const admin = await prisma.admin.findUnique({ where: { id: session.principalId } })
      if (admin?.enabled) {
        principal = { id: admin.id, role, username: admin.username }
      }
    } else {
      const studio = await prisma.studio.findUnique({ where: { id: session.principalId } })
      if (
        studio?.enabled &&
        studio.tokenVersion === session.studioTokenVersion
      ) {
        principal = { id: studio.id, role, studioId: studio.id }
      }
    }

    if (!principal) {
      await prisma.session.delete({ where: { id: session.id } })
      return null
    }

    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    })
    return principal
  }

  async destroy(rawToken?: string) {
    if (!rawToken) return
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(rawToken) } })
  }

  async destroyPrincipal(role: PrincipalType, principalId: string) {
    await prisma.session.deleteMany({
      where: { principalType: role, principalId },
    })
  }
}

export function setSessionCookie(
  reply: FastifyReply,
  role: PrincipalType,
  rawToken: string,
  expiresAt: Date,
) {
  reply.setCookie(sessionCookieNames[role], rawToken, cookieOptions(expiresAt))
}

export function clearSessionCookie(reply: FastifyReply, role: PrincipalType) {
  reply.clearCookie(sessionCookieNames[role], { path: '/' })
}

export const sessionService = new SessionService()
