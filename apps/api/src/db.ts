import { PrismaPg } from '@prisma/adapter-pg'
import { config } from './config.js'
import { PrismaClient } from './generated/prisma/client.js'

const adapter = new PrismaPg({
  connectionString: config.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: config.NODE_ENV === 'test' ? 5 : 10,
})

export const prisma = new PrismaClient({ adapter })
