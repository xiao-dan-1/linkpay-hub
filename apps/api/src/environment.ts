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
