import {
  createTaskBatchResponseSchema,
  createTaskChunkResponseSchema,
  nextTaskResponseSchema,
  taskListSchema,
  taskSchema,
} from '@studio/contracts'
import type { Task as ApiTask, TaskStatus } from '@studio/contracts'
import type { Task } from '../domain/models'
import { apiRequest } from './client'

const CHUNK_SIZE = 200

export function toTask(task: ApiTask): Task {
  return {
    id: task.publicId,
    publicId: task.publicId,
    url: task.url,
    at: task.at,
    status: task.status,
    queueSeq: task.queueSeq,
    submittedAt: task.submittedAt,
    processingStartedAt: task.processingStartedAt,
    completedAt: task.completedAt,
    feedback: task.feedback,
    userLabel: task.userLabel,
    version: task.version,
  }
}

function queryString(input: { status?: TaskStatus; search?: string; limit?: number }) {
  const query = new URLSearchParams()
  if (input.status) query.set('status', input.status)
  if (input.search) query.set('search', input.search)
  query.set('limit', String(input.limit ?? 100))
  return query.toString()
}

export async function submitTasks(urls: string[], at?: string) {
  const batch = createTaskBatchResponseSchema.parse(await apiRequest('/api/v1/user/task-batches', {
    method: 'POST', body: { requestedCount: urls.length },
  }))
  const publicIds: string[] = []
  const chunkBody = (urls: string[]) => ({
    batchId: batch.batchId,
    idempotencyKey: crypto.randomUUID(),
    urls,
    ...(at?.trim() ? { at: at.trim() } : {}),
  })
  for (let offset = 0; offset < urls.length; offset += CHUNK_SIZE) {
    const chunk = createTaskChunkResponseSchema.parse(await apiRequest(
      `/api/v1/user/task-batches/${batch.batchId}/chunks`,
      {
        method: 'POST',
        body: chunkBody(urls.slice(offset, offset + CHUNK_SIZE)),
      },
    ))
    publicIds.push(...chunk.taskPublicIds)
  }
  return publicIds
}

export async function listUserTasks() {
  const result = taskListSchema.parse(await apiRequest(`/api/v1/user/tasks?${queryString({})}`))
  return result.items.map(toTask)
}

export async function listStudioTasks(input: { status?: TaskStatus; search?: string } = {}) {
  const result = taskListSchema.parse(await apiRequest(`/api/v1/studio/tasks?${queryString(input)}`))
  return result.items.map(toTask)
}

export async function openStudioTask(publicId: string) {
  return toTask(taskSchema.parse(await apiRequest(`/api/v1/studio/tasks/${encodeURIComponent(publicId)}/open`, {
    method: 'POST',
  })))
}

export async function completeStudioTask(
  publicId: string,
  result: 'success' | 'failed',
  version: number,
  feedback?: string,
) {
  return toTask(taskSchema.parse(await apiRequest(`/api/v1/studio/tasks/${encodeURIComponent(publicId)}/complete`, {
    method: 'POST', body: { result, version, ...(feedback?.trim() ? { feedback } : {}) },
  })))
}

export async function nextStudioTask(publicId: string) {
  const response = nextTaskResponseSchema.parse(await apiRequest(
    `/api/v1/studio/tasks/${encodeURIComponent(publicId)}/next`,
    { method: 'POST' },
  ))
  return response.task ? toTask(response.task) : null
}

