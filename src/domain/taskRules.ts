import type { Task } from './models'

const HTTP_URL_PATTERN = /^https?:\/\//i

export type ParsedSubmission = {
  valid: string[]
  invalid: string[]
  blankCount: number
  duplicateCount: number
}

export function parseSubmittedLinks(input: string): ParsedSubmission {
  const lines = input.split(/\r?\n/).map((line) => line.trim())
  const blankCount = lines.filter((line) => !line).length
  const invalid: string[] = []
  const valid: string[] = []
  const seen = new Set<string>()
  let duplicateCount = 0

  for (const line of lines) {
    if (!line) {
      continue
    }

    if (!HTTP_URL_PATTERN.test(line)) {
      invalid.push(line)
      continue
    }

    if (seen.has(line)) {
      duplicateCount += 1
      continue
    }

    seen.add(line)
    valid.push(line)
  }

  if (valid.length > 10) {
    throw new Error('单次最多提交 10 条链接')
  }

  return { valid, invalid, blankCount, duplicateCount }
}

export function openTaskState(task: Task, now: string): Task {
  if (task.status !== 'queued') {
    return task
  }

  return {
    ...task,
    status: 'processing',
    processingStartedAt: now,
  }
}

export function completeTaskState(
  task: Task,
  result: 'success' | 'failed',
  now: string,
): Task {
  if (task.status !== 'processing') {
    throw new Error('只有处理中的任务可以完成')
  }

  return {
    ...task,
    status: result,
    completedAt: now,
  }
}
