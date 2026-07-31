import type { Prisma } from '../generated/prisma/client.js'

export function writeAudit(
  transaction: Prisma.TransactionClient,
  input: {
    actorId: string
    action: string
    targetType?: string
    targetId?: string
    metadata?: Prisma.InputJsonValue
  },
) {
  return transaction.auditLog.create({
    data: {
      actorType: 'admin',
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
    },
  })
}

