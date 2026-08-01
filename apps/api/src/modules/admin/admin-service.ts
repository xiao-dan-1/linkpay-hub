import type { TaskStatus, UpdateTaskInput } from '@linkpay/contracts'
import { config } from '../../config.js'
import { prisma } from '../../db.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { writeAudit } from '../../lib/audit.js'
import { AppError, notFoundError } from '../../lib/errors.js'
import { createOpaqueToken, hashToken } from '../../lib/tokens.js'
import {
  createUserAccessKey,
  decryptAccessKey,
  encryptAccessKey,
  hashUserAccessKey,
  keyDisplayParts,
  maskUserAccessKey,
  normalizeUserAccessKey,
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
  accessTokenCipher: string | null
}) {
  return {
    id: studio.id,
    name: studio.name,
    enabled: studio.enabled,
    createdAt: studio.createdAt.toISOString(),
    updatedAt: studio.updatedAt.toISOString(),
    entryUrl: studio.accessTokenCipher
      ? `${config.APP_ORIGIN}/studio/${decryptAccessKey(studio.accessTokenCipher)}`
      : null,
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

  async trends(days: number) {
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    // Generate all date keys in the range using local-date strings,
    // so the keys match the stored timestamps regardless of timezone.
    function localDateKey(d: Date) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }

    const dateKeys: string[] = []
    const cursor = new Date(startDate)
    while (cursor <= endDate) {
      dateKeys.push(localDateKey(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    // Initialize zero buckets
    const buckets = new Map<string, { submitted: number; completed: number; success: number; failed: number }>()
    for (const key of dateKeys) {
      buckets.set(key, { submitted: 0, completed: 0, success: 0, failed: 0 })
    }

    const tasks = await prisma.task.findMany({
      where: { submittedAt: { gte: startDate } },
      select: { submittedAt: true, completedAt: true, status: true },
    })

    for (const task of tasks) {
      const submitKey = localDateKey(task.submittedAt)
      const submitBucket = buckets.get(submitKey)
      if (submitBucket) submitBucket.submitted++

      if (task.completedAt) {
        const doneKey = localDateKey(task.completedAt)
        const doneBucket = buckets.get(doneKey)
        if (doneBucket) {
          doneBucket.completed++
          if (task.status === 'success') doneBucket.success++
          if (task.status === 'failed') doneBucket.failed++
        }
      }
    }

    return {
      daily: dateKeys.map((date) => ({
        date,
        ...buckets.get(date)!,
      })),
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

  async updateTask(adminId: string, publicId: string, input: UpdateTaskInput) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findUnique({ where: { publicId } })
      if (!task) throw notFoundError()

      if (task.status !== 'queued' && task.status !== 'failed') {
        throw new AppError(409, 'TASK_NOT_EDITABLE', '只有排队中或失败的任务可以编辑')
      }

      const isFailed = task.status === 'failed'
      const updated = await transaction.task.updateMany({
        where: {
          id: task.id,
          status: isFailed ? 'failed' : 'queued',
          version: input.version,
        },
        data: {
          url: input.url,
          at: input.at ?? null,
          status: 'queued',
          submittedAt: new Date(),
          processingStartedAt: null,
          completedAt: null,
          feedback: null,
          version: { increment: 1 },
        },
      })
      if (updated.count !== 1) {
        throw new AppError(409, 'TASK_STATE_CONFLICT', '任务已被其他操作修改，请刷新后重试')
      }

      await writeAudit(transaction, {
        actorId: adminId,
        action: 'task.updated',
        targetType: 'task',
        targetId: task.id,
        metadata: { publicId: task.publicId },
      })

      const current = await transaction.task.findUniqueOrThrow({
        where: { id: task.id },
        include: { user: { select: userIdentitySelect } },
      })
      return serializeTask(current)
    })
  },

  async deleteTask(adminId: string, publicId: string) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findUnique({ where: { publicId } })
      if (!task) throw notFoundError()

      if (task.status !== 'queued' && task.status !== 'failed') {
        throw new AppError(409, 'TASK_NOT_DELETABLE', '只有排队中或失败的任务可以删除')
      }

      await transaction.task.delete({ where: { id: task.id } })

      await writeAudit(transaction, {
        actorId: adminId,
        action: 'task.deleted',
        targetType: 'task',
        targetId: task.id,
        metadata: { publicId: task.publicId, status: task.status },
      })
    })
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

  async createUserKey(adminId: string, rawNote?: string, customKey?: string) {
    const note = rawNote?.trim() || null
    const accessKey = customKey
      ? normalizeUserAccessKey(customKey)
      : createUserAccessKey()
    const { keyPrefix, keySuffix } = keyDisplayParts(accessKey)

    const user = await prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findFirst({ where: { enabled: true } })
      if (!studio) throw notFoundError()
      if (customKey) {
        const existing = await transaction.user.findUnique({
          where: { accessKeyHash: hashUserAccessKey(accessKey) },
        })
        if (existing) {
          throw new AppError(409, 'USER_KEY_EXISTS', '该自定义密钥已存在，请更换')
        }
      }
      const created = await transaction.user.create({
        data: {
          accessKeyHash: hashUserAccessKey(accessKey),
          accessKeyCipher: encryptAccessKey(accessKey),
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

  async updateUserKey(adminId: string, userId: string, input: { note?: string; key?: string }) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } })
      if (!user) throw notFoundError()

      const data: Record<string, unknown> = {}
      if (input.note !== undefined) data.note = input.note?.trim() || null
      if (input.key) {
        const normalizedKey = normalizeUserAccessKey(input.key)
        const existing = await transaction.user.findUnique({ where: { accessKeyHash: hashUserAccessKey(normalizedKey) } })
        if (existing && existing.id !== userId) {
          throw new AppError(409, 'USER_KEY_EXISTS', '该密钥已存在，请更换')
        }
        const { keyPrefix, keySuffix } = keyDisplayParts(normalizedKey)
        data.accessKeyHash = hashUserAccessKey(normalizedKey)
        data.accessKeyCipher = encryptAccessKey(normalizedKey)
        data.keyPrefix = keyPrefix
        data.keySuffix = keySuffix
      }

      const updated = await transaction.user.update({
        where: { id: userId },
        data,
        include: userCountInclude,
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'user.key_updated',
        targetType: 'user',
        targetId: userId,
      })
      return serializeUser(updated)
    })
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

  async deleteUser(adminId: string, userId: string) {
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        include: { _count: { select: { tasks: true } } },
      })
      if (!user) throw notFoundError()
      if (user._count.tasks > 0) {
        throw new AppError(409, 'USER_HAS_TASKS', '该密钥已有任务记录，无法删除，请改用「停用」')
      }
      await transaction.user.delete({ where: { id: userId } })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'user.deleted',
        targetType: 'user',
        targetId: userId,
        ...(user.note ? { metadata: { note: user.note } } : {}),
      })
    })
  },

  async revealUserKey(adminId: string, userId: string) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: userId } })
      if (!user) throw notFoundError()
      if (!user.accessKeyCipher) {
        throw new AppError(404, 'KEY_NOT_STORED', '该密钥创建于「可复制」功能之前，无法查看完整密钥')
      }
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'user.key_revealed',
        targetType: 'user',
        targetId: userId,
      })
      return { accessKey: decryptAccessKey(user.accessKeyCipher) }
    })
  },

  async getStudio() {
    const studio = await prisma.studio.findFirst()
    if (!studio) throw notFoundError()
    return serializeStudio(studio)
  },

  async listStudios() {
    const studios = await prisma.studio.findMany({ orderBy: { createdAt: 'asc' } })
    return studios.map(serializeStudio)
  },

  async createStudio(adminId: string, name: string) {
    const rawToken = createOpaqueToken()
    return prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.create({
        data: {
          name,
          accessTokenHash: hashToken(rawToken),
          accessTokenCipher: encryptAccessKey(rawToken),
        },
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'studio.created',
        targetType: 'studio',
        targetId: studio.id,
        metadata: { name },
      })
      return {
        studio: serializeStudio(studio),
        accessToken: rawToken,
      }
    })
  },

  async updateStudio(adminId: string, studioId: string, name: string) {
    return prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findUnique({ where: { id: studioId } })
      if (!studio) throw notFoundError()
      const updated = await transaction.studio.update({
        where: { id: studioId }, data: { name },
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'studio.updated',
        targetType: 'studio',
        targetId: studioId,
        metadata: { name },
      })
      return serializeStudio(updated)
    })
  },

  async rotateAccess(adminId: string, studioId: string) {
    const rawToken = createOpaqueToken()
    await prisma.$transaction(async (transaction) => {
      const studio = await transaction.studio.findUnique({ where: { id: studioId } })
      if (!studio) throw notFoundError()
      await transaction.studio.update({
        where: { id: studioId },
        data: {
          accessTokenHash: hashToken(rawToken),
          accessTokenCipher: encryptAccessKey(rawToken),
          tokenVersion: { increment: 1 },
        },
      })
      await writeAudit(transaction, {
        actorId: adminId,
        action: 'studio.access_rotated',
        targetType: 'studio',
        targetId: studioId,
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

