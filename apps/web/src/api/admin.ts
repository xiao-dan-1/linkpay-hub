import {
  adminUserSchema,
  auditLogListSchema,
  createUserKeyResponseSchema,
  dashboardSchema,
  rotatedLinkSchema,
  studioSchema,
  taskListSchema,
  taskSchema,
  trendsResponseSchema,
  userKeyRevealResponseSchema,
} from '@studio/contracts'
import type { TaskStatus, TrendsResponse } from '@studio/contracts'
import { z } from 'zod'
import type { Studio, User } from '../domain/models'
import { apiRequest } from './client'
import { toTask } from './tasks'

const userListSchema = z.object({
  items: z.array(adminUserSchema),
  page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
})

export async function getDashboard() {
  return dashboardSchema.parse(await apiRequest('/api/v1/admin/dashboard'))
}

export async function getTrends(days = 30): Promise<TrendsResponse> {
  const query = new URLSearchParams({ days: String(days) })
  return trendsResponseSchema.parse(await apiRequest(`/api/v1/admin/trends?${query}`))
}

export async function listAdminTasks(input: { status?: TaskStatus; search?: string } = {}) {
  const query = new URLSearchParams({ limit: '100' })
  if (input.status) query.set('status', input.status)
  if (input.search) query.set('search', input.search)
  const result = taskListSchema.parse(await apiRequest(`/api/v1/admin/tasks?${query}`))
  return result.items.map(toTask)
}

export async function getAdminTask(publicId: string) {
  return toTask(taskSchema.parse(await apiRequest(`/api/v1/admin/tasks/${encodeURIComponent(publicId)}`)))
}

export async function listUsers(search = ''): Promise<User[]> {
  const query = new URLSearchParams({ limit: '100' })
  if (search) query.set('search', search)
  const result = userListSchema.parse(await apiRequest(`/api/v1/admin/users?${query}`))
  return result.items
}

export async function setUserEnabled(userId: string, enabled: boolean) {
  return adminUserSchema.parse(await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH', body: { enabled },
  }))
}

export async function createUserKey(note?: string, key?: string) {
  return createUserKeyResponseSchema.parse(await apiRequest('/api/v1/admin/user-keys', {
    method: 'POST',
    body: {
      ...(note?.trim() ? { note: note.trim() } : {}),
      ...(key?.trim() ? { key: key.trim() } : {}),
    },
  }))
}

export async function updateUserKey(userId: string, data: { note?: string; key?: string }) {
  return adminUserSchema.parse(await apiRequest(`/api/v1/admin/user-keys/${encodeURIComponent(userId)}`, {
    method: 'PATCH', body: data,
  }))
}

export async function revealUserKey(userId: string) {
  return userKeyRevealResponseSchema.parse(
    await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/key`),
  )
}

export async function deleteUser(userId: string) {
  await apiRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE' })
}

export async function getStudio(): Promise<Studio> {
  return studioSchema.parse(await apiRequest('/api/v1/admin/studio'))
}

export async function updateStudio(name: string): Promise<Studio> {
  return studioSchema.parse(await apiRequest('/api/v1/admin/studio', {
    method: 'PATCH', body: { name },
  }))
}

export async function rotateAccess() {
  return rotatedLinkSchema.parse(await apiRequest('/api/v1/admin/studio/rotate-access', {
    method: 'POST',
  })).url
}

export async function listAuditLogs() {
  return auditLogListSchema.parse(await apiRequest('/api/v1/admin/audit-logs?limit=100'))
}
