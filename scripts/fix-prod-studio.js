const { PrismaClient } = require('/app/apps/api/dist/generated/prisma/client')
const crypto = require('crypto')
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } })

function createOpaqueToken() { return crypto.randomBytes(32).toString('base64url') }
function hashToken(t) { return crypto.createHash('sha256').update(t).digest('hex') }
function keyEncryptionKey() { return crypto.createHash('sha256').update(process.env.COOKIE_SECRET).digest() }
function encryptAccessKey(key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', keyEncryptionKey(), iv)
  return Buffer.concat([iv, cipher.getAuthTag(), cipher.update(key,'utf8'), cipher.final()]).toString('base64')
}

;(async () => {
  const s = await p.studio.findFirst()
  const raw = createOpaqueToken()
  await p.studio.update({
    where: { id: s.id },
    data: {
      accessTokenHash: hashToken(raw),
      accessTokenCipher: encryptAccessKey(raw),
      tokenVersion: { increment: 1 },
    },
  })
  console.log('Studio URL: http://45.203.217.19:18080/studio/' + raw)
  await p.$disconnect()
})()
