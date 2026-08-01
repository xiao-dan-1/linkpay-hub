import 'dotenv/config'
import { prisma } from '../apps/api/src/db.js'

const s = await prisma.studio.findFirst()
console.log('name:', s?.name)
console.log('cipher:', s?.accessTokenCipher ? `yes (${s.accessTokenCipher.slice(0, 20)}…)` : 'NULL')
console.log('version:', s?.tokenVersion)
await prisma.$disconnect()
