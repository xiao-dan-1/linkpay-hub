import type { SessionPrincipal } from '@studio/contracts'
import { sessionResponseSchema } from '@studio/contracts'
import { apiRequest } from './client'

function principal(response: unknown) {
  return sessionResponseSchema.parse(response).principal
}

export async function getUserSession() {
  return principal(await apiRequest('/api/v1/auth/user/session'))
}

export async function loginUser(username: string, password: string) {
  return principal(await apiRequest('/api/v1/auth/user/login', {
    method: 'POST', body: { username, password },
  }))
}

export async function registerUser(
  registrationCode: string,
  username: string,
  password: string,
) {
  return principal(await apiRequest(`/api/v1/auth/register/${encodeURIComponent(registrationCode)}`, {
    method: 'POST', body: { username, password },
  }))
}

export function logoutUser() {
  return apiRequest<void>('/api/v1/auth/user/logout', { method: 'POST' })
}

export async function getAdminSession() {
  return principal(await apiRequest('/api/v1/auth/admin/session'))
}

export async function loginAdmin(username: string, password: string) {
  return principal(await apiRequest('/api/v1/auth/admin/login', {
    method: 'POST', body: { username, password },
  }))
}

export function logoutAdmin() {
  return apiRequest<void>('/api/v1/auth/admin/logout', { method: 'POST' })
}

export async function exchangeStudioToken(accessToken: string): Promise<SessionPrincipal> {
  return principal(await apiRequest(`/api/v1/auth/studio/exchange/${encodeURIComponent(accessToken)}`, {
    method: 'POST',
  }))
}

export async function getStudioSession() {
  return principal(await apiRequest('/api/v1/auth/studio/session'))
}

