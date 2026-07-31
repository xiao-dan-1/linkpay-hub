import 'dotenv/config'
import { prisma } from '../db.js'
import { hashPassword } from '../lib/passwords.js'

const username = process.env.ADMIN_USERNAME?.trim()
const password = process.env.ADMIN_PASSWORD
if (!username || !password) {
  throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required')
}
const normalizedUsername = username.toLocaleLowerCase('en-US')
if (await prisma.admin.findUnique({ where: { normalizedUsername } })) {
  throw new Error('Administrator already exists')
}
await prisma.admin.create({
  data: { username, normalizedUsername, passwordHash: await hashPassword(password) },
})
await prisma.$disconnect()
console.log(`Administrator ${username} created.`)
