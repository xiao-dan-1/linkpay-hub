import { describe, expect, it } from 'vitest'
import { resolveDevServerConfig } from './vite-env'

describe('development server configuration', () => {
  it('uses the configured web and API ports', () => {
    expect(resolveDevServerConfig({ PORT: '3001', WEB_PORT: '5174' })).toEqual({
      apiTarget: 'http://127.0.0.1:3001',
      webPort: 5174,
    })
  })

  it('keeps the standard ports when no overrides are provided', () => {
    expect(resolveDevServerConfig({})).toEqual({
      apiTarget: 'http://127.0.0.1:3000',
      webPort: 5173,
    })
  })
})
