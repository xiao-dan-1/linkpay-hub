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

export const userLoginSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
})

export const adminLoginSchema = userLoginSchema
export const userRegistrationSchema = userLoginSchema

export const sessionPrincipalSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'admin', 'studio']),
  username: z.string().optional(),
  studioId: z.string().uuid().optional(),
})

export const sessionResponseSchema = z.object({
  principal: sessionPrincipalSchema,
})

export const csrfResponseSchema = z.object({
  token: z.string().min(32),
})

export type UserLoginInput = z.infer<typeof userLoginSchema>
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>
export type SessionPrincipal = z.infer<typeof sessionPrincipalSchema>
