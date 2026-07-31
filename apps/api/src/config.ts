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
})

export const config = configSchema.parse(process.env)
export type AppConfig = z.infer<typeof configSchema>
