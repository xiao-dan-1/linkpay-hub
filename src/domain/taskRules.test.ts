import { describe, expect, it } from 'vitest'
import { completeTaskState, openTaskState, parseSubmittedLinks } from './taskRules'

describe('parseSubmittedLinks', () => {
  it('removes blanks and same-submit duplicates while reporting invalid URLs', () => {
    const result = parseSubmittedLinks(
      'https://a.test\n\nhttps://a.test\nftp://bad\nhttps://b.test',
    )

    expect(result.valid).toEqual(['https://a.test', 'https://b.test'])
    expect(result.blankCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
    expect(result.invalid).toEqual(['ftp://bad'])
  })

  it('rejects more than ten unique valid links', () => {
    const input = Array.from(
      { length: 11 },
      (_, index) => `https://example.com/${index}`,
    ).join('\n')

    expect(() => parseSubmittedLinks(input)).toThrow('单次最多提交 10 条链接')
  })
})

describe('task transitions', () => {
  const queued = {
    id: 'T1',
    url: 'https://a.test',
    status: 'queued' as const,
    userId: 'U1',
    studioId: 'S1',
    submittedAt: '2026-08-01T00:00:00.000Z',
  }

  it('opens a queued task once', () => {
    const processing = openTaskState(queued, '2026-08-01T01:00:00.000Z')

    expect(processing.status).toBe('processing')
    expect(
      openTaskState(processing, '2026-08-01T02:00:00.000Z').processingStartedAt,
    ).toBe('2026-08-01T01:00:00.000Z')
  })

  it('only completes processing tasks', () => {
    expect(() =>
      completeTaskState(queued, 'success', '2026-08-01T02:00:00.000Z'),
    ).toThrow('只有处理中的任务可以完成')
  })
})
