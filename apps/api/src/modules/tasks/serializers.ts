import type { Task } from '../../generated/prisma/client.js'

type TaskWithOptionalUser = Task & {
  user?: { username: string }
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
    ...(task.user ? { username: task.user.username } : {}),
    version: task.version,
  }
}

