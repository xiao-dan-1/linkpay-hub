import type { PrototypeState } from '../domain/models'
import { createDemoState } from './seed'

const STORAGE_KEY = 'studio-task-workbench:v1'

export function saveState(state: PrototypeState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function loadState(): PrototypeState {
  const raw = localStorage.getItem(STORAGE_KEY)

  if (raw) {
    return JSON.parse(raw) as PrototypeState
  }

  const seeded = createDemoState()
  saveState(seeded)
  return seeded
}

export function resetDemoState(): PrototypeState {
  const state = createDemoState()
  saveState(state)
  return state
}
