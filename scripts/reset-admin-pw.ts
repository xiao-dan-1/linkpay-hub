import { prisma } from '../apps/api/src/db.js'
import { hashPassword } from '../apps/api/src/lib/passwords.js'

const pw = process.env.NEW_PW
if (!pw) { console.error('NEW_PW required'); process.exit(1) }

const admin = await prisma.admin.findFirst()
if (!admin) { console.error('No admin'); process.exit(1) }
await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await hashPassword(pw) } })
console.log(`Updated: ${admin.username}`)
await prisma.$disconnect()
