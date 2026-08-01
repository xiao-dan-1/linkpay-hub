import type { Task } from '../../generated/prisma/client.js'
import { taskUserLabel } from '../../lib/user-keys.js'

type TaskWithOptionalUser = Task & {
  user?: {
    note: string | null
    keyPrefix: string | null
    keySuffix: string | null
  }
}

export function serializeTask(task: TaskWithOptionalUser) {
  return {
    publicId: task.publicId,
    url: task.url,
    status: task.status,
    queueSeq: task.queueSeq.toString(),
    submittedAt: task.submittedAt.toISOString(),
    ...(task.processingStartedAt
      ? { processingStartedAt: task.processingStartedAt.toISOString() }
      : {}),
    ...(task.completedAt ? { completedAt: task.completedAt.toISOString() } : {}),
    ...(task.feedback ? { feedback: task.feedback } : {}),
    ...(task.user ? { userLabel: taskUserLabel(task.user) } : {}),
    version: task.version,
  }
}

