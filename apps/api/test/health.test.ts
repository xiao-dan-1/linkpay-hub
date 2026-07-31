import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../src/app.js'

describe('Fastify application shell', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = await buildApp({ logger: false })
  })

  afterAll(async () => {
    await app.close()
  })

  it('reports process and database health', async () => {
    const live = await app.inject({ method: 'GET', url: '/health/live' })
    expect(live.statusCode).toBe(200)
    expect(live.json()).toEqual({ status: 'live' })

    const ready = await app.inject({ method: 'GET', url: '/health/ready' })
    expect(ready.statusCode).toBe(200)
    expect(ready.json()).toEqual({ status: 'ready' })
  })

  it('returns the stable API error shape', async () => {
    const response = await app.inject({ method: 'GET', url: '/missing' })
    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        message: '请求的资源不存在',
        requestId: expect.any(String),
      },
    })
  })
})
