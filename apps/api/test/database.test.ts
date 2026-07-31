import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'

describe('database schema', () => {
  beforeAll(async () => {
    await prisma.submissionChunk.deleteMany()
    await prisma.submissionBatch.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.session.deleteMany()
    await prisma.task.deleteMany()
    await prisma.user.deleteMany()
    await prisma.admin.deleteMany()
    await prisma.studio.deleteMany()
  })

  afterAll(() => prisma.$disconnect())

  it('assigns a stable increasing queue sequence', async () => {
    const studio = await prisma.studio.create({
      data: {
        name: '测试工作室',
        registrationCodeHash: 'registration-hash',
        accessTokenHash: 'access-hash',
      },
    })
    const user = await prisma.user.create({
      data: {
        username: 'demo',
        normalizedUsername: 'demo',
        passwordHash: 'password-hash',
        studioId: studio.id,
      },
    })
    const first = await prisma.task.create({
      data: {
        publicId: 'TASK-ONE',
        url: 'https://one.test',
        userId: user.id,
        studioId: studio.id,
      },
    })
    const second = await prisma.task.create({
      data: {
        publicId: 'TASK-TWO',
        url: 'https://two.test',
        userId: user.id,
        studioId: studio.id,
      },
    })

    expect(second.queueSeq > first.queueSeq).toBe(true)
  })
})
