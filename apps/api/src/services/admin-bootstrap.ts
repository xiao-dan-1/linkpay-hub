import { adminLoginSchema } from '@studio/contracts'
import { prisma } from '../db.js'
import { hashPassword } from '../lib/passwords.js'

export type AdminBootstrapResult =
  | { status: 'disabled' }
  | { status: 'created'; username: string }
  | { status: 'skipped'; username: string }

export async function bootstrapAdmin(input: {
  username?: string
  password?: string
}): Promise<AdminBootstrapResult> {
  const username = input.username?.trim() || undefined
  const password = input.password || undefined

  if (!username && !password) return { status: 'disabled' }
  if (!username || !password) {
    throw new Error(
      'ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD must be configured together',
    )
  }

  const credentials = adminLoginSchema.parse({ username, password })
  const existing = await prisma.admin.findFirst({ select: { username: true } })
  if (existing) return { status: 'skipped', username: existing.username }

  const admin = await prisma.admin.create({
    data: {
      username: credentials.username,
      normalizedUsername: credentials.username.toLocaleLowerCase('en-US'),
      passwordHash: await hashPassword(credentials.password),
    },
    select: { username: true },
  })
  return { status: 'created', username: admin.username }
}
