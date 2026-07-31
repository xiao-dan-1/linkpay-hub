import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_USER_ID } from './seed'
import { loadState, resetDemoState, saveState } from './storage'

describe('prototype storage', () => {
  beforeEach(() => localStorage.clear())

  it('seeds the single studio and demo user when empty', () => {
    const state = loadState()

    expect(state.studios).toHaveLength(1)
    expect(state.users.some((user) => user.id === DEMO_USER_ID)).toBe(true)
  })

  it('persists mutations and resets to deterministic demo data', () => {
    const state = loadState()
    saveState({ ...state, users: [] })

    expect(loadState().users).toHaveLength(0)
    expect(resetDemoState().users.some((user) => user.id === DEMO_USER_ID)).toBe(true)
  })
})
