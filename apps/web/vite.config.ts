import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { resolveDevServerConfig } from './vite-env'

const envDir = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, envDir, '')
  const { apiTarget, webPort } = resolveDevServerConfig(environment)

  return {
    envDir,
    plugins: [react()],
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/health': apiTarget,
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
    },
  }
})
