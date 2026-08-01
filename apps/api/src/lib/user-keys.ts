import { createHash, randomBytes } from 'node:crypto'

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
  return key.trim().toUpperCase()
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
