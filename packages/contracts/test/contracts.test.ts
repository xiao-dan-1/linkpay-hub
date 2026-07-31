import { describe, expect, it } from 'vitest'
import {
  createTaskChunkSchema,
  taskSchema,
  userLoginSchema,
} from '../src/index'

describe('production contracts', () => {
  it('validates login credentials', () => {
    expect(
      userLoginSchema.parse({ username: 'demo', password: 'secret12' }),
    ).toEqual({ username: 'demo', password: 'secret12' })
    expect(() =>
      userLoginSchema.parse({ username: 'demo', password: '1' }),
    ).toThrow()
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
      }).status,
    ).toBe('queued')
  })
})
