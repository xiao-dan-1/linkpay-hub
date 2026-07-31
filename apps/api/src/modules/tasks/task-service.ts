import { randomBytes } from 'node:crypto'
import type { CreateTaskChunkInput, TaskStatus } from '@studio/contracts'
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
            },
          })
          taskPublicIds.push(task.publicId)
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
}

