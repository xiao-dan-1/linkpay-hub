import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../apps/api/src/generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

await prisma.$disconnect()
console.log('Production database is ready; no demo accounts were created.')
