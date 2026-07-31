import {
  adminUserSchema,
  auditLogListSchema,
  dashboardSchema,
  rotatedLinkSchema,
  studioSchema,
  taskListSchema,
  taskSchema,
} from '@studio/contracts'
import type { TaskStatus } from '@studio/contracts'
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

export async function getStudio(): Promise<Studio> {
  return studioSchema.parse(await apiRequest('/api/v1/admin/studio'))
}

export async function updateStudio(name: string): Promise<Studio> {
  return studioSchema.parse(await apiRequest('/api/v1/admin/studio', {
    method: 'PATCH', body: { name },
  }))
}

export async function rotateRegistration() {
  return rotatedLinkSchema.parse(await apiRequest('/api/v1/admin/studio/rotate-registration', {
    method: 'POST',
  })).url
}

export async function rotateAccess() {
  return rotatedLinkSchema.parse(await apiRequest('/api/v1/admin/studio/rotate-access', {
    method: 'POST',
  })).url
}

export async function listAuditLogs() {
  return auditLogListSchema.parse(await apiRequest('/api/v1/admin/audit-logs?limit=100'))
}
