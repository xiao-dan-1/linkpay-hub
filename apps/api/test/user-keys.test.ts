import { describe, expect, it } from 'vitest'
import {
  createUserAccessKey,
  hashUserAccessKey,
  keyDisplayParts,
  maskUserAccessKey,
  sessionUserLabel,
  taskUserLabel,
} from '../src/lib/user-keys.js'

describe('user access keys', () => {
  it('generates an 80-bit formatted key and derives safe display values', () => {
    const key = createUserAccessKey()

    expect(key).toMatch(/^USR-[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/)
    expect(hashUserAccessKey(key)).toHaveLength(64)
    expect(keyDisplayParts(key)).toEqual({
      keyPrefix: key.slice(0, 8),
      keySuffix: key.slice(-4),
    })
    expect(maskUserAccessKey({
      keyPrefix: key.slice(0, 8),
      keySuffix: key.slice(-4),
    })).toBe(`${key.slice(0, 8)}-••••-••••-${key.slice(-4)}`)
  })

  it('prefers notes and otherwise produces role-appropriate labels', () => {
    expect(taskUserLabel({ note: '客户 A', keyPrefix: null, keySuffix: null })).toBe('客户 A')
    expect(taskUserLabel({ note: null, keyPrefix: null, keySuffix: null })).toBe('历史用户')
    expect(sessionUserLabel({ note: null, keyPrefix: null, keySuffix: 'PQRS' }))
      .toBe('密钥用户 · 尾号 PQRS')
  })
})
