import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEnvironment } from '../src/environment.js'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('environment loading', () => {
  it('loads an explicit environment file into the supplied process environment', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'studio-env-'))
    temporaryDirectories.push(directory)
    const envFile = join(directory, '.env')
    await writeFile(envFile, 'PORT=3001\nAPP_ORIGIN=http://127.0.0.1:5174\n')
    const processEnvironment: Record<string, string | undefined> = {}

    loadEnvironment({ envFile, processEnvironment })

    expect(processEnvironment).toMatchObject({
      PORT: '3001',
      APP_ORIGIN: 'http://127.0.0.1:5174',
    })
  })
})
