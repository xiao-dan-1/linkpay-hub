import { beforeEach, describe, expect, it } from 'vitest'
import { PrototypeRepository } from './repository'
import { resetDemoState } from './storage'

describe('PrototypeRepository', () => {
  beforeEach(() => resetDemoState())

  it('registers a user against the studio registration code', () => {
    const repository = new PrototypeRepository()
    const user = repository.registerUser('demo-studio', 'new-user', 'secret1')

    expect(user.studioId).toBe('studio-demo')
  })

  it('creates independent queued tasks and returns them FIFO', () => {
    const repository = new PrototypeRepository()
    const created = repository.createTasks(
      'user-demo',
      ['https://x.test', 'https://y.test'],
      '2026-08-02T00:00:00.000Z',
    )

    expect(created).toHaveLength(2)
    expect(repository.getStudioTasks('studio-demo').at(-1)?.id).toBe(
      created.at(-1)?.id,
    )
  })

  it('opens and completes a task while preserving terminal states', () => {
    const repository = new PrototypeRepository()
    const opened = repository.openTask(
      'TASK-1001',
      'studio-demo',
      '2026-08-02T01:00:00.000Z',
    )

    expect(opened.status).toBe('processing')
    const completed = repository.completeTask(
      opened.id,
      'studio-demo',
      'success',
      '2026-08-02T02:00:00.000Z',
      '支付链接已确认',
    )
    expect(completed.status).toBe('success')
    expect(completed.feedback).toBe('支付链接已确认')
    expect(() =>
      repository.completeTask(
        opened.id,
        'studio-demo',
        'failed',
        '2026-08-02T03:00:00.000Z',
      ),
    ).toThrow()
  })
})
