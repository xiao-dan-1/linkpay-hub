import { randomBytes } from 'node:crypto'
import type {
  CompleteTaskInput,
  CreateTaskChunkInput,
  TaskStatus,
  UpdateTaskInput,
} from '@linkpay/contracts'
import { prisma } from '../../db.js'
import { Prisma } from '../../generated/prisma/client.js'
import { AppError, notFoundError } from '../../lib/errors.js'
import { serializeTask } from './serializers.js'

function createPublicId() {
  return `TASK-${randomBytes(6).toString('hex').toUpperCase()}`
}

function encodeCursor(queueSeq: bigint) {
  return Buffer.from(queueSeq.toString(), 'utf8').toString('base64url')
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    if (!/^\d+$/.test(decoded)) throw new Error('invalid cursor')
    return BigInt(decoded)
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', '分页游标无效')
  }
}

function chunkResult(chunk: {
  batchId: string
  createdCount: number
  taskPublicIds: Prisma.JsonValue
}, cumulativeCreatedCount: number) {
  return {
    batchId: chunk.batchId,
    createdCount: chunk.createdCount,
    cumulativeCreatedCount,
    taskPublicIds: Array.isArray(chunk.taskPublicIds)
      ? chunk.taskPublicIds.filter((value): value is string => typeof value === 'string')
      : [],
  }
}

export const taskService = {
  async createBatch(userId: string, requestedCount: number) {
    return prisma.submissionBatch.create({
      data: { userId, requestedCount },
    })
  },

  async createChunk(
    userId: string,
    studioId: string,
    input: CreateTaskChunkInput,
  ) {
    const batch = await prisma.submissionBatch.findFirst({
      where: { id: input.batchId, userId },
    })
    if (!batch) throw notFoundError()

    const existing = await prisma.submissionChunk.findUnique({
      where: {
        batchId_idempotencyKey: {
          batchId: input.batchId,
          idempotencyKey: input.idempotencyKey,
        },
      },
    })
    if (existing) {
      return {
        replayed: true,
        response: chunkResult(existing, batch.createdCount),
      }
    }

    const urls = [...new Set(input.urls)]
    if (batch.createdCount + urls.length > batch.requestedCount) {
      throw new AppError(409, 'BATCH_COUNT_EXCEEDED', '提交数量超过任务批次声明数量')
    }

    try {
      return await prisma.$transaction(async (transaction) => {
        const taskPublicIds: string[] = []
        for (const url of urls) {
          const task = await transaction.task.create({
            data: {
              publicId: createPublicId(),
              url,
              userId,
              studioId,
              ...(input.at ? { at: input.at } : {}),
            },
          })
          // 顺序任务编号取自数据库自增序号：TASK-1、TASK-2…
          const publicId = `TASK-${task.queueSeq}`
          await transaction.task.update({
            where: { id: task.id },
            data: { publicId },
          })
          taskPublicIds.push(publicId)
        }

        const chunk = await transaction.submissionChunk.create({
          data: {
            batchId: input.batchId,
            idempotencyKey: input.idempotencyKey,
            createdCount: taskPublicIds.length,
            taskPublicIds,
          },
        })
        const updatedBatch = await transaction.submissionBatch.update({
          where: { id: input.batchId },
          data: { createdCount: { increment: taskPublicIds.length } },
        })
        return {
          replayed: false,
          response: chunkResult(chunk, updatedBatch.createdCount),
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const repeated = await prisma.submissionChunk.findUniqueOrThrow({
          where: {
            batchId_idempotencyKey: {
              batchId: input.batchId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: { batch: true },
        })
        return {
          replayed: true,
          response: chunkResult(repeated, repeated.batch.createdCount),
        }
      }
      throw error
    }
  },

  async listUserTasks(input: {
    userId: string
    status?: TaskStatus
    search?: string
    cursor?: string
    limit: number
  }) {
    const cursor = decodeCursor(input.cursor)
    const tasks = await prisma.task.findMany({
      where: {
        userId: input.userId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { publicId: { contains: input.search, mode: 'insensitive' } },
                { url: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursor !== undefined ? { queueSeq: { lt: cursor } } : {}),
      },
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
          ? encodeCursor(items[items.length - 1]!.queueSeq)
          : null,
      },
    }
  },

  async getUserTask(userId: string, publicId: string) {
    const task = await prisma.task.findFirst({ where: { userId, publicId } })
    if (!task) throw notFoundError()
    return serializeTask(task)
  },

  async updateTask(
    userId: string,
    publicId: string,
    input: UpdateTaskInput,
  ) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: { userId, publicId },
      })
      if (!task) throw notFoundError()

      if (task.status !== 'queued' && task.status !== 'failed') {
        throw new AppError(409, 'TASK_NOT_EDITABLE', '只有排队中或失败的任务可以编辑')
      }

      const isFailed = task.status === 'failed'
      const updated = await transaction.task.updateMany({
        where: {
          id: task.id,
          userId,
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

      await transaction.auditLog.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'task.updated',
          targetType: 'task',
          targetId: task.id,
          metadata: { publicId: task.publicId },
        },
      })

      const current = await transaction.task.findUniqueOrThrow({
        where: { id: task.id },
        include: { user: { select: { note: true, keyPrefix: true, keySuffix: true } } },
      })
      return serializeTask(current)
    })
  },

  async deleteTask(userId: string, publicId: string) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: { userId, publicId },
      })
      if (!task) throw notFoundError()

      if (task.status !== 'queued' && task.status !== 'failed') {
        throw new AppError(409, 'TASK_NOT_DELETABLE', '只有排队中或失败的任务可以删除')
      }

      await transaction.task.delete({ where: { id: task.id } })

      await transaction.auditLog.create({
        data: {
          actorType: 'user',
          actorId: userId,
          action: 'task.deleted',
          targetType: 'task',
          targetId: task.id,
          metadata: { publicId: task.publicId, status: task.status },
        },
      })
    })
  },

  async listStudioTasks(input: {
    studioId: string
    status?: TaskStatus
    search?: string
    cursor?: string
    limit: number
  }) {
    const cursor = decodeCursor(input.cursor)
    const tasks = await prisma.task.findMany({
      where: {
        studioId: input.studioId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.search
          ? {
              OR: [
                { publicId: { contains: input.search, mode: 'insensitive' } },
                { url: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursor !== undefined ? { queueSeq: { gt: cursor } } : {}),
      },
      orderBy: { queueSeq: 'asc' },
      take: input.limit + 1,
    })
    const hasMore = tasks.length > input.limit
    const items = hasMore ? tasks.slice(0, input.limit) : tasks
    return {
      items: items.map(serializeTask),
      page: {
        hasMore,
        nextCursor: hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!.queueSeq)
          : null,
      },
    }
  },

  async openStudioTask(studioId: string, publicId: string) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: { studioId, publicId },
      })
      if (!task) throw notFoundError()

      if (task.status === 'queued') {
        const opened = await transaction.task.updateMany({
          where: { id: task.id, studioId, status: 'queued' },
          data: {
            status: 'processing',
            processingStartedAt: new Date(),
            version: { increment: 1 },
          },
        })
        if (opened.count === 1) {
          await transaction.auditLog.create({
            data: {
              actorType: 'studio',
              actorId: studioId,
              action: 'task.processing_started',
              targetType: 'task',
              targetId: task.id,
              metadata: { publicId: task.publicId },
            },
          })
        }
      }

      const current = await transaction.task.findUniqueOrThrow({
        where: { id: task.id },
      })
      return serializeTask(current)
    })
  },

  async completeStudioTask(
    studioId: string,
    publicId: string,
    input: CompleteTaskInput,
  ) {
    return prisma.$transaction(async (transaction) => {
      const task = await transaction.task.findFirst({
        where: { studioId, publicId },
      })
      if (!task) throw notFoundError()

      const completed = await transaction.task.updateMany({
        where: {
          id: task.id,
          studioId,
          status: 'processing',
          version: input.version,
        },
        data: {
          status: input.result,
          feedback: input.feedback?.trim() || null,
          completedAt: new Date(),
          version: { increment: 1 },
        },
      })
      if (completed.count !== 1) {
        throw new AppError(409, 'TASK_STATE_CONFLICT', '任务状态已被其他操作更新')
      }

      await transaction.auditLog.create({
        data: {
          actorType: 'studio',
          actorId: studioId,
          action: 'task.completed',
          targetType: 'task',
          targetId: task.id,
          metadata: { publicId: task.publicId, result: input.result },
        },
      })
      const current = await transaction.task.findUniqueOrThrow({
        where: { id: task.id },
      })
      return serializeTask(current)
    })
  },

  async nextStudioTask(studioId: string, publicId: string) {
    const current = await prisma.task.findFirst({ where: { studioId, publicId } })
    if (!current) throw notFoundError()
    const next = await prisma.task.findFirst({
      where: { studioId, queueSeq: { gt: current.queueSeq } },
      orderBy: { queueSeq: 'asc' },
    })
    if (!next) return null
    return this.openStudioTask(studioId, next.publicId)
  },

  // 工作室直接创建任务（无需 batch/chunk）
  async createStudioTasks(
    studioId: string,
    input: { urls: string[]; at?: string },
  ) {
    const urls = [...new Set(input.urls)]
    if (urls.length === 0) return { taskPublicIds: [] as string[] }
    if (urls.length > 200) throw new AppError(400, 'TOO_MANY_URLS', '单次最多 200 条链接')

    const taskPublicIds: string[] = []
    await prisma.$transaction(async (transaction) => {
      for (const url of urls) {
        const task = await transaction.task.create({
          data: {
            publicId: createPublicId(),
            url,
            studioId,
            userId: '', // studio-created tasks have no user
            ...(input.at ? { at: input.at } : {}),
          },
        })
        const publicId = `TASK-${task.queueSeq}`
        await transaction.task.update({
          where: { id: task.id },
          data: { publicId },
        })
        taskPublicIds.push(publicId)
      }
    })

    return { taskPublicIds, createdCount: taskPublicIds.length }
  },
}
