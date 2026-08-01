import 'dotenv/config'
import { prisma } from '../apps/api/src/db.js'
import { hashPassword } from '../apps/api/src/lib/passwords.js'

const NEW_PASSWORD = process.env.NEW_ADMIN_PASSWORD
if (!NEW_PASSWORD) {
  throw new Error('NEW_ADMIN_PASSWORD is required')
}

const admin = await prisma.admin.findFirst()
if (!admin) {
  console.error('No admin account exists in the database.')
  process.exit(1)
}

await prisma.admin.update({
  where: { id: admin.id },
  data: { passwordHash: await hashPassword(NEW_PASSWORD) },
})

console.log(`Password updated for admin "${admin.username}".`)
await prisma.$disconnect()
