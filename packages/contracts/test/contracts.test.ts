import { describe, expect, it } from 'vitest'
import {
  createUserKeySchema,
  createTaskChunkSchema,
  taskSchema,
  userKeyLoginSchema,
} from '../src/index'

describe('production contracts', () => {
  it('validates and normalizes reusable user access keys', () => {
    expect(
      userKeyLoginSchema.parse({ key: ' usr-abcd-efgh-jkmn-pqrs ' }),
    ).toEqual({ key: 'USR-ABCD-EFGH-JKMN-PQRS' })
    expect(() =>
      userKeyLoginSchema.parse({ key: 'USR-ABCI-EFGH-JKMN-PQRS' }),
    ).toThrow()
  })

  it('validates optional administrator key notes', () => {
    expect(createUserKeySchema.parse({ note: ' 客户 A ' })).toEqual({ note: '客户 A' })
    expect(createUserKeySchema.parse({})).toEqual({})
    expect(() => createUserKeySchema.parse({ note: 'a'.repeat(201) })).toThrow()
  })

  it('limits transport chunks while preserving unlimited user submissions', () => {
    const urls = Array.from(
      { length: 200 },
      (_, index) => `https://example.test/${index}`,
    )
    expect(
      createTaskChunkSchema.parse({
        batchId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        urls,
      }).urls,
    ).toHaveLength(200)
    expect(() =>
      createTaskChunkSchema.parse({
        batchId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        urls: [...urls, 'https://extra.test'],
      }),
    ).toThrow()
  })

  it('defines the stable public task response', () => {
    expect(
      taskSchema.parse({
        publicId: 'TASK-AB12CD34',
        url: 'https://example.test/pay',
        status: 'queued',
        queueSeq: '1',
        submittedAt: '2026-08-01T00:00:00.000Z',
        version: 0,
        userLabel: '客户 A',
      }).userLabel,
    ).toBe('客户 A')
  })
})
