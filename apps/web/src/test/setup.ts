import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { resetCsrfToken } from '../api/client'
import { installMockApi } from './mockApi'

beforeEach(() => {
  resetCsrfToken()
  installMockApi()
})

afterEach(() => {
  vi.unstubAllGlobals()
})
