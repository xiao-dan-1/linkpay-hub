import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'

const ACCESS_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

type UserKeyDisplay = {
  keyPrefix: string | null
  keySuffix: string | null
}

type UserIdentity = UserKeyDisplay & {
  note: string | null
}

export function createUserAccessKey() {
  const bytes = randomBytes(10)
  const value = BigInt(`0x${bytes.toString('hex')}`)
  let encoded = ''

  for (let index = 0; index < 16; index += 1) {
    const shift = BigInt((15 - index) * 5)
    encoded += ACCESS_KEY_ALPHABET[Number((value >> shift) & 31n)]
  }

  return `USR-${encoded.match(/.{4}/g)!.join('-')}`
}

export function normalizeUserAccessKey(key: string) {
  return key.trim()
}

export function hashUserAccessKey(key: string) {
  return createHash('sha256').update(normalizeUserAccessKey(key)).digest('hex')
}

export function keyDisplayParts(key: string) {
  const normalized = normalizeUserAccessKey(key)
  return {
    keyPrefix: normalized.slice(0, 8),
    keySuffix: normalized.slice(-4),
  }
}

function keyEncryptionKey() {
  return createHash('sha256').update(config.COOKIE_SECRET).digest()
}

export function encryptAccessKey(accessKey: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(accessKey, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptAccessKey(blob: string) {
  const raw = Buffer.from(blob, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const encrypted = raw.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', keyEncryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function maskUserAccessKey(user: UserKeyDisplay) {
  return user.keyPrefix && user.keySuffix
    ? `${user.keyPrefix}-••••-••••-${user.keySuffix}`
    : '历史用户'
}

export function taskUserLabel(user: UserIdentity) {
  return user.note?.trim() || maskUserAccessKey(user)
}

export function sessionUserLabel(user: UserIdentity) {
  return user.note?.trim() || `密钥用户 · 尾号 ${user.keySuffix ?? '----'}`
}
