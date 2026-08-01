import 'dotenv/config'
import { prisma } from '../apps/api/src/db.js'
import { createOpaqueToken, hashToken } from '../apps/api/src/lib/tokens.js'
import { encryptAccessKey } from '../apps/api/src/lib/user-keys.js'

const studio = await prisma.studio.findFirst()
if (!studio) { console.log('No studio found'); process.exit(1) }

const rawToken = createOpaqueToken()
await prisma.studio.update({
  where: { id: studio.id },
  data: {
    accessTokenHash: hashToken(rawToken),
    accessTokenCipher: encryptAccessKey(rawToken),
    tokenVersion: { increment: 1 },
  },
})

console.log('Studio cipher fixed.')
console.log(`New entry URL: http://localhost:5174/studio/${rawToken}`)
await prisma.$disconnect()
