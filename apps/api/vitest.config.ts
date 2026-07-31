import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      APP_ORIGIN: 'http://127.0.0.1:5173',
    },
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
