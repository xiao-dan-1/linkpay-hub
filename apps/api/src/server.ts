import { buildApp } from './app.js'

const app = await buildApp({ logger: true })

await app.listen({
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
})
