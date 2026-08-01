import 'dotenv/config'
import { prisma } from '../db.js'
import { createOpaqueToken, hashToken } from '../lib/tokens.js'

const name = process.env.STUDIO_NAME?.trim()
const appOrigin = process.env.APP_ORIGIN
if (!name || !appOrigin) {
  throw new Error('STUDIO_NAME and APP_ORIGIN are required')
}
if (await prisma.studio.findFirst()) {
  throw new Error('A studio already exists')
}
const accessToken = createOpaqueToken()
await prisma.studio.create({
  data: {
    name,
    accessTokenHash: hashToken(accessToken),
  },
})
await prisma.$disconnect()
console.log(`Studio URL: ${appOrigin}/studio/${accessToken}`)
