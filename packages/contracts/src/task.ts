import { z } from 'zod'
import { pageInfoSchema } from './common'

export const taskStatusSchema = z.enum([
  'queued',
  'processing',
  'success',
  'failed',
])

export const paymentUrlSchema = z
  .string()
  .url()
  .max(8192)
  .refine((value) => {
    const protocol = new URL(value).protocol
    return protocol === 'http:' || protocol === 'https:'
  }, '仅支持 HTTP 或 HTTPS 链接')

export const taskSchema = z.object({
  publicId: z.string().min(1),
  url: paymentUrlSchema,
  status: taskStatusSchema,
  queueSeq: z.string().regex(/^\d+$/),
  submittedAt: z.string().datetime(),
  processingStartedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  feedback: z.string().max(2000).optional(),
  username: z.string().optional(),
  version: z.number().int().nonnegative(),
})

export const createTaskBatchSchema = z.object({
  requestedCount: z.number().int().positive(),
})

export const createTaskBatchResponseSchema = z.object({
  batchId: z.string().uuid(),
  requestedCount: z.number().int().positive(),
  createdCount: z.number().int().nonnegative(),
})

export const createTaskChunkSchema = z.object({
  batchId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  urls: z.array(paymentUrlSchema).min(1).max(200),
})

export const createTaskChunkResponseSchema = z.object({
  batchId: z.string().uuid(),
  createdCount: z.number().int().nonnegative(),
  cumulativeCreatedCount: z.number().int().nonnegative(),
  taskPublicIds: z.array(z.string()),
})

export const completeTaskSchema = z.object({
  result: z.enum(['success', 'failed']),
  feedback: z.string().trim().max(2000).optional(),
  version: z.number().int().nonnegative(),
})

export const taskListQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  search: z.string().trim().max(500).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const taskListSchema = z.object({
  items: z.array(taskSchema),
  page: pageInfoSchema,
})

export const nextTaskResponseSchema = z.object({
  task: taskSchema.nullable(),
})

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type Task = z.infer<typeof taskSchema>
export type CreateTaskChunkInput = z.infer<typeof createTaskChunkSchema>
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>
