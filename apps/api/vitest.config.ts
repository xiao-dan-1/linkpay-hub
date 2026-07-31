import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { requireTestDatabaseUrl } from './src/environment.js'

const envDir = fileURLToPath(new URL('../..', import.meta.url))
const environment = loadEnv('test', envDir, '')

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: requireTestDatabaseUrl(environment.TEST_DATABASE_URL),
      APP_ORIGIN: environment.TEST_APP_ORIGIN || 'http://127.0.0.1:5173',
    },
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
