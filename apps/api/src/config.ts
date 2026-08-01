import { z } from 'zod'
import { loadEnvironment } from './environment.js'

loadEnvironment()

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  APP_ORIGIN: z.string().url(),
  COOKIE_SECRET: z.string().min(32),
  USER_SESSION_HOURS: z.coerce.number().int().positive().default(168),
  STUDIO_SESSION_HOURS: z.coerce.number().int().positive().default(12),
  LINK_GEN_API_URL: z.string().url().default('https://link.gpt007.org'),
  LINK_GEN_USERNAME: z.string().min(1).default('linkadmin'),
  LINK_GEN_PASSWORD: z.string().min(1),
})

export const config = configSchema.parse(process.env)
export type AppConfig = z.infer<typeof configSchema>
