import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/db.js'
import { verifyPassword } from '../src/lib/passwords.js'
import { bootstrapAdmin } from '../src/services/admin-bootstrap.js'

describe('administrator bootstrap', () => {
  beforeEach(async () => {
    await prisma.session.deleteMany()
    await prisma.admin.deleteMany()
  })

  it('stays disabled when neither bootstrap variable is configured', async () => {
    await expect(bootstrapAdmin({})).resolves.toEqual({ status: 'disabled' })
    await expect(prisma.admin.count()).resolves.toBe(0)
  })

  it('rejects a partially configured bootstrap account', async () => {
    await expect(bootstrapAdmin({ username: 'admin' })).rejects.toThrow(
      'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD must be configured together',
    )
    await expect(prisma.admin.count()).resolves.toBe(0)
  })

  it('creates the first administrator with a password hash', async () => {
    await expect(bootstrapAdmin({
      username: 'Admin',
      password: 'StrongPassword123!',
    })).resolves.toEqual({ status: 'created', username: 'Admin' })

    const admin = await prisma.admin.findUniqueOrThrow({
      where: { normalizedUsername: 'admin' },
    })
    expect(admin.passwordHash).not.toBe('StrongPassword123!')
    await expect(verifyPassword(admin.passwordHash, 'StrongPassword123!')).resolves.toBe(true)
  })

  it('skips when an administrator already exists without changing its password', async () => {
    await bootstrapAdmin({ username: 'existing', password: 'ExistingPassword123!' })
    const before = await prisma.admin.findFirstOrThrow()

    await expect(bootstrapAdmin({
      username: 'replacement',
      password: 'ReplacementPassword123!',
    })).resolves.toEqual({ status: 'skipped', username: 'existing' })

    const admins = await prisma.admin.findMany()
    expect(admins).toHaveLength(1)
    expect(admins[0]?.passwordHash).toBe(before.passwordHash)
  })
})
