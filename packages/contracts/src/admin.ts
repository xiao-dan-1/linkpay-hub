import { z } from 'zod'
import { pageInfoSchema } from './common.js'

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  maskedKey: z.string(),
  note: z.string().nullable(),
  studioId: z.string().uuid(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  lastUsedAt: z.string().datetime().nullable(),
  taskCount: z.number().int().nonnegative(),
})

export const createUserKeySchema = z.object({
  note: z.string().trim().max(200, '备注最多 200 个字符').optional(),
  key: z
    .string()
    .trim()
    .regex(/^\S{4,64}$/, '自定义密钥需 4-64 位非空白字符')
    .optional(),
})

export const createUserKeyResponseSchema = z.object({
  user: adminUserSchema,
  accessKey: z.string().regex(/^\S{4,64}$/),
})

export const updateUserEnabledSchema = z.object({
  enabled: z.boolean(),
})

export const updateUserKeySchema = z.object({
  note: z.string().trim().max(200, '备注最多 200 个字符').optional(),
  key: z.string().trim().regex(/^\S{4,64}$/, '密钥需 4-64 位非空白字符').optional(),
})

export const userKeyRevealResponseSchema = z.object({
  accessKey: z.string(),
})

export const studioSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  entryUrl: z.string().nullable(),
  linkGenApiUrl: z.string().nullable(),
  linkGenUsername: z.string().nullable(),
  linkGenPassword: z.string().nullable(),
})

export const updateStudioSchema = z.object({
  name: z.string().trim().min(1).max(120),
  linkGenApiUrl: z.string().trim().optional(),
  linkGenUsername: z.string().trim().optional(),
  linkGenPassword: z.string().trim().optional(),
})

export const rotatedLinkSchema = z.object({
  url: z.string().url(),
})

export const auditLogSchema = z.object({
  id: z.string(),
  actorType: z.enum(['user', 'admin', 'studio', 'system']),
  actorId: z.string().uuid().optional(),
  action: z.string(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
})

export const auditLogListSchema = z.object({
  items: z.array(auditLogSchema),
  page: pageInfoSchema,
})

export const dashboardSchema = z.object({
  users: z.number().int().nonnegative(),
  tasks: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})

export const trendPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  submitted: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  success: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
})
export type TrendPoint = z.infer<typeof trendPointSchema>

export const trendsResponseSchema = z.object({
  daily: z.array(trendPointSchema),
})
export type TrendsResponse = z.infer<typeof trendsResponseSchema>

export const trendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})
