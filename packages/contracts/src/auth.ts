import { z } from 'zod'

export const usernameSchema = z
  .string()
  .trim()
  .min(3, '账号至少需要 3 个字符')
  .max(64, '账号最多 64 个字符')

export const passwordSchema = z
  .string()
  .min(8, '密码至少需要 8 个字符')
  .max(256, '密码最多 256 个字符')

export const adminLoginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

export const userAccessKeySchema = z
  .string()
  .trim()
  .pipe(z.string().regex(
    /^\S{4,64}$/,
    '请输入有效的用户密钥',
  ))

export const userKeyLoginSchema = z.object({
  key: userAccessKeySchema,
})

export const sessionPrincipalSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'admin', 'studio']),
  username: z.string().optional(),
  userLabel: z.string().optional(),
  studioId: z.string().uuid().optional(),
})

export const sessionResponseSchema = z.object({
  principal: sessionPrincipalSchema,
})

export const csrfResponseSchema = z.object({
  token: z.string().min(32),
})

export type UserKeyLoginInput = z.infer<typeof userKeyLoginSchema>
export type SessionPrincipal = z.infer<typeof sessionPrincipalSchema>
