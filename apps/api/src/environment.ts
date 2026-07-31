import { config as loadDotenv } from 'dotenv'
import { fileURLToPath } from 'node:url'

const rootEnvironmentFile = fileURLToPath(new URL('../../../.env', import.meta.url))

export function loadEnvironment(options: {
  envFile?: string
  processEnvironment?: Record<string, string | undefined>
} = {}) {
  return loadDotenv({
    path: options.envFile ?? process.env.ENV_FILE ?? rootEnvironmentFile,
    processEnv: options.processEnvironment ?? process.env,
    quiet: true,
  })
}

export function requireTestDatabaseUrl(value: string | undefined) {
  if (!value) throw new Error('TEST_DATABASE_URL is required')
  const databaseName = decodeURIComponent(new URL(value).pathname.split('/').pop() ?? '')
  if (!databaseName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must use a database whose name ends with _test')
  }
  return value
}
