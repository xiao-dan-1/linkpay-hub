import type { TaskStatus } from '@studio/contracts'
import { config } from '../../config.js'
import { prisma } from '../../db.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { writeAudit } from '../../lib/audit.js'
import { notFoundError } from '../../lib/errors.js'
import { createOpaqueToken, hashToken } from '../../lib/tokens.js'
import {
  createUserAccessKey,
  hashUserAccessKey,
  keyDisplayParts,
  maskUserAccessKey,
} from '../../lib/user-keys.js'
import { serializeTask } from '../tasks/serializers.js'

function encodeCursor(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function decodeCursor(value?: string) {
  if (!value) return undefined
  return Buffer.from(value, 'base64url').toString('utf8')
}

function serializeUser(user: {
  id: string
  keyPrefix: string | null
  keySuffix: string | null
  note: string | null
  studioId: string
  enabled: boolean
  createdAt: Date
  lastUsedAt: Date | null
  _count: { tasks: number }
}) {
  return {
    id: user.id,
    maskedKey: maskUserAccessKey(user),
    note: user.note,
    studioId: user.studioId,
    enabled: user.enabled,
    createdAt: user.createdAt.toISOString(),
    lastUsedAt: user.lastUsedAt?.toISOString() ?? null,
    taskCount: user._count.tasks,
  }
}

const userIdentitySelect = {
  note: true,
  keyPrefix: true,
  keySuffix: true,
} as const

const userCountInclude = {
  _count: { select: { tasks: true } },
} as const

function serializeStudio(studio: {
  id: string
  name: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: studio.id,
    name: studio.name,
    enabled: studio.enabled,
    createdAt: studio.createdAt.toISOString(),
    updatedAt: studio.updatedAt.toISOString(),
  }
}

function objectMetadata(value: Prisma.JsonValue | null) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined
}

export const adminService = {
  async dashboard() {
    const [users, grouped] = await Promise.all([
      prisma.user.count(),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
    ])
    const counts = Object.fromEntries(
      grouped.map((row) => [row.status, row._count._all]),
    ) as Partial<Record<TaskStatus, number>>
    const queued = counts.queued ?? 0
    const processing = counts.processing ?? 0
    const success = counts.success ?? 0
    const failed = counts.failed ?? 0
    return {
      users,
      tasks: queued + processing + success + failed,
      queued,
      processing,
      success,
      failed,
    }
  },

  async listTasks(input: {
    status?: TaskStatus
    search?: string
    cursor?: string
    limit: number
  }) {
    const cursor = decodeCursor(input.cursor)
    const queueSeq = cursor && /^\d+$/.test(cursor) ? BigInt(cursor) : undefined
    const tasks = await prisma.task.findMany({
      where: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? { OR: [
              { publicId: { contains: input.search, mode: 'insensitive' } },
              { url: { contains: input.search, mode: 'insensitive' } },
              { user: { note: { contains: input.search, mode: 'insensitive' } } },
              { user: { keyPrefix: { contains: input.search, mode: 'insensitive' } } },
              { user: { keySuffix: { contains: input.search, mode: 'insensitive' } } },
            ] }
          : {}),
        ...(queueSeq !== undefined ? { queueSeq: { lt: queueSeq } } : {}),
      },
      include: { user: { select: userIdentitySelect } },
      orderBy: { queueSeq: 'desc' },
      take: input.limit + 1,
    })
    const hasMore = tasks.length > input.limit
    const items = hasMore ? tasks.slice(0, input.limit) : tasks
    return {
      items: items.map(serializeTask),
      page: {
        hasMore,
        nextCursor: hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!.queueSeq.toString())
          : null,
      },
    }
  },

  async getTask(publicId: string) {
    const task = await prisma.task.findUnique({
      where: { publicId },
      include: { user: { select: userIdentitySelect } },
    })
    if (!task) throw notFoundError()
    return serializeTask(task)
  },

  async listUsers(input: { search?: string; cursor?: string; limit: number }) {
    const cursor = decodeCursor(input.cursor)
    const users = await prisma.user.findMany({
      where: input.search
        ? { OR: [
            { note: { contains: input.search, mode: 'insensitive' } },
            { keyPrefix: { contains: input.search, mode: 'insensitive' } },
            { keySuffix: { contains: input.search, mode: 'insensitive' } },
          ] }
        : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      include: userCountInclude,
    })
    const hasMore = users.length > input.limit
    const items = hasMore ? users.slice(0, input.limit) : users
    return {
      items: items.map(serializeUser),
      page: {
        hasMore,
        nextCursor: hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!.id)
          : null,
      },
    }
  },

  async createUserKey(adminId: string, rawNote?: string) {
    const accessKey = createUserAccessKey()
    const note = rawNote?.trim() || null
    const { keyPrefix, keySuffix } = keyDisplayParts(accessKey)

    const user = await prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findFirst({ where: { enabled: true } })
      if (!studio) throw notFoundError()
      const created = await transaction.user.create({
        data: {
          accessKeyHash: hashUserAccessKey(accessKey),
          keyPrefix,
          keySuffix,
          note,
          studioId: studio.id,
        },
        include: userCountInclude,
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'user.key_created',
        targetType: 'user',
        targetId: created.id,
        ...(note ? { metadata: { note } } : {}),
      })
      return created
    })

    return { user: serializeUser(user), accessKey }
  },

  async updateUserEnabled(adminId: string, userId: string, enabled: boolean) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } })
      if (!user) throw notFoundError()
      const updated = await transaction.user.update({
        where: { id: userId },
        data: { enabled },
        include: userCountInclude,
      })
      if (!enabled) {
        await transaction.session.deleteMany({
          where: { principalType: 'user', principalId: userId },
        })
      }
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'user.key_enabled_updated',
        targetType: 'user',
        targetId: userId,
        metadata: { enabled },
      })
      return serializeUser(updated)
    })
  },

  async getStudio() {
    const studio = await prisma.studio.findFirst()
    if (!studio) throw notFoundError()
    return serializeStudio(studio)
  },

  async updateStudio(adminId: string, name: string) {
    return prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findFirst()
      if (!studio) throw notFoundError()
      const updated = await transaction.studio.update({
        where: { id: studio.id }, data: { name },
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'studio.updated',
        targetType: 'studio',
        targetId: studio.id,
        metadata: { name },
      })
      return serializeStudio(updated)
    })
  },

  async rotateAccess(adminId: string) {
    const rawToken = createOpaqueToken()
    await prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findFirst()
      if (!studio) throw notFoundError()
      await transaction.studio.update({
        where: { id: studio.id },
        data: {
          accessTokenHash: hashToken(rawToken),
          tokenVersion: { increment: 1 },
        },
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'studio.access_rotated',
        targetType: 'studio',
        targetId: studio.id,
      })
    })
    return { url: `${config.APP_ORIGIN}/studio/${rawToken}` }
  },

  async listAuditLogs(input: { cursor?: string; limit: number }) {
    const cursor = decodeCursor(input.cursor)
    const id = cursor && /^\d+$/.test(cursor) ? BigInt(cursor) : undefined
    const logs = await prisma.auditLog.findMany({
      where: id !== undefined ? { id: { lt: id } } : undefined,
      orderBy: { id: 'desc' },
      take: input.limit + 1,
    })
    const hasMore = logs.length > input.limit
    const items = hasMore ? logs.slice(0, input.limit) : logs
    return {
      items: items.map((log) => ({
        id: log.id.toString(),
        actorType: log.actorType,
        ...(log.actorId ? { actorId: log.actorId } : {}),
        action: log.action,
        ...(log.targetType ? { targetType: log.targetType } : {}),
        ...(log.targetId ? { targetId: log.targetId } : {}),
        ...(objectMetadata(log.metadata) ? { metadata: objectMetadata(log.metadata) } : {}),
        createdAt: log.createdAt.toISOString(),
      })),
      page: {
        hasMore,
        nextCursor: hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!.id.toString())
          : null,
      },
    }
  },
}

