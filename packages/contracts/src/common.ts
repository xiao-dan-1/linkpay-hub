import { z } from 'zod'

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
    fields: z.record(z.string(), z.string()).optional(),
  }),
})

export const pageInfoSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
export type PageInfo = z.infer<typeof pageInfoSchema>
