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
})

export const createUserKeyResponseSchema = z.object({
  user: adminUserSchema,
  accessKey: z.string().regex(/^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/),
})

export const updateUserEnabledSchema = z.object({
  enabled: z.boolean(),
})

export const studioSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const updateStudioSchema = z.object({
  name: z.string().trim().min(1).max(120),
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
