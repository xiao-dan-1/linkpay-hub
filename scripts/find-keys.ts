import 'dotenv/config'
import { prisma } from '../apps/api/src/db.js'
import { decryptAccessKey, maskUserAccessKey } from '../apps/api/src/lib/user-keys.js'

const users = await prisma.user.findMany({ take: 10 })
for (const u of users) {
  const raw = u.accessKeyCipher ? decryptAccessKey(u.accessKeyCipher) : '(no cipher)'
  console.log(`note: ${u.note ?? '(none)'} | masked: ${maskUserAccessKey(u)} | raw: ${raw}`)
}
await prisma.$disconnect()
